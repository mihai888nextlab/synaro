import type { EnvironmentStatus } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  parseRemoteStatus,
  pickActiveRuntimeEnvironment,
  remoteCreateEnvironment,
  remoteDestroyEnvironment,
  remoteStartEnvironment,
  remoteStopEnvironment,
  type RemoteEnvironment,
} from "@/lib/environment-service-api";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { projectRowToCardModel } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { authOptions } from "@/lib/next-auth-options";

function previewHostBase(): string {
  const fromEnv = process.env.SYNARO_PREVIEW_HOST?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost";
}

function projectUpdateFromRemoteEnv(env: RemoteEnvironment): {
  environmentStatus: EnvironmentStatus;
  repositoryLocation: string | null;
} {
  const st = parseRemoteStatus(env.status) ?? "ERROR";
  const port = typeof env.port === "number" ? env.port : null;
  const repositoryLocation =
    st === "RUNNING" && port != null ? `${previewHostBase()}:${port}` : null;
  return { environmentStatus: st, repositoryLocation };
}

async function respondWithSyncedCard(projectId: string, res: NextApiResponse) {
  const row = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const sum = await latestEnvironmentSummariesByProjectId([projectId]);
  const s = sum[projectId] ?? null;
  const st = s ? parseEnvironmentStatusFromService(s.status) : null;
  const merged = st ? { ...row, environmentStatus: st } : row;
  res.status(200).json({ project: projectRowToCardModel(merged, 0) });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).end();
      return;
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    const raw = req.body as { action?: unknown };
    const action = raw.action;
    if (action !== "start" && action !== "stop") {
      res.status(400).json({ error: "Body must include action: \"start\" | \"stop\"" });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      select: { id: true, userId: true, cloneRepositoryUrl: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    let env: RemoteEnvironment | null = null;

    const createOpts =
      project.cloneRepositoryUrl != null && project.cloneRepositoryUrl.length > 0
        ? {
            gitRemoteUrl: project.cloneRepositoryUrl,
            gitAccessToken:
              (await getGithubAccessTokenForUser(project.userId)) ?? undefined,
          }
        : undefined;

    if (action === "stop") {
      const rows = await fetchEnvironmentsForProject(projectId);
      const active = pickActiveRuntimeEnvironment(rows);
      if (!rows.length) {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "INACTIVE", repositoryLocation: null },
        });
        await respondWithSyncedCard(projectId, res);
        return;
      }
      if (!active) {
        const latest = rows[0]!;
        const patch = projectUpdateFromRemoteEnv(latest);
        await prisma.project.update({ where: { id: projectId }, data: patch });
        await respondWithSyncedCard(projectId, res);
        return;
      }
      if (active.status === "RUNNING" || active.status === "PROVISIONING") {
        env = await remoteStopEnvironment(active.id);
      }
    } else {
      const rows = await fetchEnvironmentsForProject(projectId);
      const active = pickActiveRuntimeEnvironment(rows);

      if (!active) {
        const stopped = rows.find((r) => r.status === "STOPPED" && r.containerId);
        if (stopped) {
          env = await remoteStartEnvironment(stopped.id);
        } else if (!rows.length) {
          env = await remoteCreateEnvironment(projectId, "node:20-alpine", createOpts);
        } else {
          const head = rows[0]!;
          await remoteDestroyEnvironment(head.id);
          const image =
            typeof head.image === "string" && head.image.length > 0 ? head.image : "node:20-alpine";
          env = await remoteCreateEnvironment(projectId, image, createOpts);
        }
      } else {
        if (active.status === "RUNNING") {
          const patch = projectUpdateFromRemoteEnv(active);
          await prisma.project.update({ where: { id: projectId }, data: patch });
          await respondWithSyncedCard(projectId, res);
          return;
        }
        if (active.status === "PROVISIONING") {
          res.status(409).json({ error: "Environment is already starting. Wait for it to finish." });
          return;
        }
        res.status(500).json({ error: `Unexpected environment status: ${active.status}` });
        return;
      }
    }

    if (!env) {
      res.status(500).json({ error: "Unexpected empty environment result" });
      return;
    }

    const patch = projectUpdateFromRemoteEnv(env);
    await prisma.project.update({ where: { id: projectId }, data: patch });
    await respondWithSyncedCard(projectId, res);
  } catch (err) {
    console.error("[api/projects/docker]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (projectId) {
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "ERROR" },
        });
      } catch {
        /* ignore */
      }
    }
    res.status(502).json({ error: msg });
  }
}
