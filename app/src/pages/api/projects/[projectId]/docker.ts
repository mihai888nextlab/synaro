import type { EnvironmentStatus } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  parseRemoteStatus,
  remoteCreateEnvironment,
  remoteDestroyEnvironment,
  remoteStartEnvironment,
  remoteStopEnvironment,
  type RemoteEnvironment,
} from "@/lib/environment-service-api";
import { projectRowToCardModel } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

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
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    let env: RemoteEnvironment | null = null;

    if (action === "stop") {
      const rows = await fetchEnvironmentsForProject(projectId);
      const latest = rows[0];
      if (!latest) {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "INACTIVE", repositoryLocation: null },
        });
        await respondWithSyncedCard(projectId, res);
        return;
      }
      if (latest.status === "RUNNING") {
        env = await remoteStopEnvironment(latest.id);
      } else {
        const patch = projectUpdateFromRemoteEnv(latest);
        await prisma.project.update({ where: { id: projectId }, data: patch });
        await respondWithSyncedCard(projectId, res);
        return;
      }
    } else {
      const rows = await fetchEnvironmentsForProject(projectId);
      const latest = rows[0];
      if (!latest) {
        env = await remoteCreateEnvironment(projectId);
      } else if (latest.status === "RUNNING") {
        const patch = projectUpdateFromRemoteEnv(latest);
        await prisma.project.update({ where: { id: projectId }, data: patch });
        await respondWithSyncedCard(projectId, res);
        return;
      } else if (latest.status === "PROVISIONING") {
        res.status(409).json({ error: "Environment is already starting. Wait for it to finish." });
        return;
      } else if (latest.status === "STOPPED" && latest.containerId) {
        env = await remoteStartEnvironment(latest.id);
      } else {
        await remoteDestroyEnvironment(latest.id);
        env = await remoteCreateEnvironment(projectId);
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
