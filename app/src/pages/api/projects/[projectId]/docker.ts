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
import { recordDockerActivityLog, recordProjectActivityLog } from "@/lib/activity-log";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { projectRowToCardModel } from "@/lib/map-project-to-card";
import { whereProjectByIdForUser } from "@/lib/project-access";
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
  if (st !== "RUNNING") return { environmentStatus: st, repositoryLocation: null };

  // Prefer the public URL returned by the environment service (set when SYNARO_DOMAIN is configured).
  // Fall back to localhost:{port} for local development.
  const port = typeof env.port === "number" ? env.port : null;
  const repositoryLocation =
    env.publicUrl ?? (port != null ? `${previewHostBase()}:${port}` : null);
  return { environmentStatus: st, repositoryLocation };
}

async function respondWithSyncedCard(projectId: string, res: NextApiResponse, viewerUserId: string) {
  const row = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const sum = await latestEnvironmentSummariesByProjectId([projectId]);
  const s = sum[projectId] ?? null;
  const st = s ? parseEnvironmentStatusFromService(s.status) : null;
  const merged = st ? { ...row, environmentStatus: st } : row;
  res.status(200).json({ project: projectRowToCardModel(merged, 0, { viewerUserId }) });
}

/** Return the project's current card immediately with a 202 (work continues in the background). */
async function respondProvisioning(projectId: string, res: NextApiResponse, viewerUserId: string) {
  const row = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  res.status(202).json({ project: projectRowToCardModel(row, 0, { viewerUserId }) });
}

/**
 * Run a long provisioning op (image pull + git clone can take minutes) WITHOUT holding the
 * HTTP request open — that would blow past Cloudflare's ~100s origin timeout and surface as a
 * 524 HTML page ("Invalid response from server."). environment-service owns the authoritative
 * status; when the op settles we reconcile the app's Project row, and the projects list poll
 * flips the card to RUNNING (or ERROR) in the meantime.
 */
function provisionInBackground(
  projectId: string,
  actorUserId: string,
  op: () => Promise<RemoteEnvironment>,
): void {
  void op()
    .then(async (env) => {
      const patch = projectUpdateFromRemoteEnv(env);
      await prisma.project.update({ where: { id: projectId }, data: patch });
      await recordDockerActivityLog({
        userId: actorUserId,
        projectId,
        kind: "start",
        environmentStatus: patch.environmentStatus,
      });
    })
    .catch(async (err) => {
      console.error("[api/projects/docker] background provision failed", err);
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "ERROR" },
        });
        await recordProjectActivityLog({
          userId: actorUserId,
          projectId,
          action: "Container start failed",
          status: "STOPPED",
        });
      } catch {
        /* ignore */
      }
    });
}

async function persistDockerResult(
  projectId: string,
  actorUserId: string,
  viewerUserId: string,
  kind: "start" | "stop",
  patch: { environmentStatus: EnvironmentStatus; repositoryLocation?: string | null },
  res: NextApiResponse,
) {
  await prisma.project.update({ where: { id: projectId }, data: patch });
  await recordDockerActivityLog({
    userId: actorUserId,
    projectId,
    kind,
    environmentStatus: patch.environmentStatus,
  });
  await respondWithSyncedCard(projectId, res, viewerUserId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  let actorUserId: string | null = null;
  let dockerAction: "start" | "stop" | null = null;

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
    dockerAction = action;
    actorUserId = session.user.id;

    const project = await prisma.project.findFirst({
      where: whereProjectByIdForUser(projectId, session.user.id),
      select: { id: true, userId: true, cloneRepositoryUrl: true, slug: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    let env: RemoteEnvironment | null = null;

    const createOpts = {
      ...(project.cloneRepositoryUrl != null && project.cloneRepositoryUrl.length > 0
        ? {
            gitRemoteUrl: project.cloneRepositoryUrl,
            gitAccessToken: (await getGithubAccessTokenForUser(project.userId)) ?? undefined,
          }
        : {}),
      projectSlug: project.slug,
    };

    if (action === "stop") {
      const rows = await fetchEnvironmentsForProject(projectId);
      const active = pickActiveRuntimeEnvironment(rows);
      if (!rows.length) {
        await persistDockerResult(
          projectId,
          session.user.id,
          session.user.id,
          "stop",
          { environmentStatus: "INACTIVE", repositoryLocation: null },
          res,
        );
        return;
      }
      if (!active) {
        const latest = rows[0]!;
        const patch = projectUpdateFromRemoteEnv(latest);
        await persistDockerResult(projectId, session.user.id, session.user.id, "stop", patch, res);
        return;
      }
      if (active.status === "RUNNING" || active.status === "PROVISIONING") {
        env = await remoteStopEnvironment(active.id);
      }
    } else {
      const rows = await fetchEnvironmentsForProject(projectId);
      const active = pickActiveRuntimeEnvironment(rows);

      // Already running — sync the card and return immediately (fast path).
      if (active?.status === "RUNNING") {
        const patch = projectUpdateFromRemoteEnv(active);
        await prisma.project.update({ where: { id: projectId }, data: patch });
        await respondWithSyncedCard(projectId, res, session.user.id);
        return;
      }

      // Already starting — report PROVISIONING; the projects list poll keeps watching.
      if (active?.status === "PROVISIONING") {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "PROVISIONING" },
        });
        await respondProvisioning(projectId, res, session.user.id);
        return;
      }

      // Otherwise we must provision (start a stopped env, create a fresh one, or replace a
      // dead one). Any of these can take minutes, so kick the op off in the background, mark
      // the project PROVISIONING, and return 202 immediately — see provisionInBackground.
      const startOp = (): Promise<RemoteEnvironment> => {
        const stopped = rows.find((r) => r.status === "STOPPED" && r.containerId);
        if (stopped) return remoteStartEnvironment(stopped.id);
        if (!rows.length) return remoteCreateEnvironment(projectId, "node:20-alpine", createOpts);
        const head = rows[0]!;
        const image =
          typeof head.image === "string" && head.image.length > 0 ? head.image : "node:20-alpine";
        return remoteDestroyEnvironment(head.id).then(() =>
          remoteCreateEnvironment(projectId, image, createOpts),
        );
      };

      await prisma.project.update({
        where: { id: projectId },
        data: { environmentStatus: "PROVISIONING" },
      });
      provisionInBackground(projectId, session.user.id, startOp);
      await respondProvisioning(projectId, res, session.user.id);
      return;
    }

    if (!env) {
      res.status(500).json({ error: "Unexpected empty environment result" });
      return;
    }

    const patch = projectUpdateFromRemoteEnv(env);
    await persistDockerResult(
      projectId,
      session.user.id,
      session.user.id,
      action,
      patch,
      res,
    );
  } catch (err) {
    console.error("[api/projects/docker]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (projectId) {
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { environmentStatus: "ERROR" },
        });
        if (actorUserId && dockerAction) {
          await recordProjectActivityLog({
            userId: actorUserId,
            projectId,
            action:
              dockerAction === "start" ? "Container start failed" : "Container stop failed",
            status: "STOPPED",
          });
        }
      } catch {
        /* ignore */
      }
    }
    res.status(502).json({ error: msg });
  }
}
