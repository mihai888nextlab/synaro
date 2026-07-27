import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import type { DeploymentStatus } from "@prisma/client";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { touchProjectActivity } from "@/lib/project-activity";
import {
  remoteDeployProject,
  remoteGetDeployment,
  remoteStopDeployment,
  remoteStartDeployment,
  remoteDestroyDeployment,
  remoteDeploymentLogs,
  type RemoteDeployment,
} from "@/lib/environment-service-api";

const DEPLOYMENT_STATUSES: DeploymentStatus[] = ["INACTIVE", "BUILDING", "RUNNING", "STOPPED", "ERROR"];

function coerceStatus(s: string | undefined): DeploymentStatus {
  return DEPLOYMENT_STATUSES.includes(s as DeploymentStatus) ? (s as DeploymentStatus) : "INACTIVE";
}

/** Keep the Project mirror (used by dashboard cards) in sync with the env-service deployment row. */
async function mirror(projectId: string, dep: RemoteDeployment | null): Promise<void> {
  await prisma.project
    .update({
      where: { id: projectId },
      data: {
        deploymentStatus: dep ? coerceStatus(dep.status) : "INACTIVE",
        // Only expose the URL once it's actually serving — a BUILDING subdomain 404s.
        deploymentUrl: dep?.status === "RUNNING" ? dep.publicUrl ?? null : null,
      },
    })
    .catch(() => {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const raw = req.query.projectId;
  const projectId = typeof raw === "string" ? raw : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true, slug: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const action = typeof req.query.action === "string" ? req.query.action : null;

  try {
    // ── GET — status (default) or build logs ─────────────────────────────────────────────────────
    if (req.method === "GET") {
      if (action === "logs") {
        const lines = await remoteDeploymentLogs(projectId);
        return res.json({ lines });
      }
      const dep = await remoteGetDeployment(projectId);
      await mirror(projectId, dep);
      return res.json({ deployment: dep });
    }

    // ── POST — deploy (default) or start a stopped deployment ─────────────────────────────────────
    if (req.method === "POST") {
      touchProjectActivity(projectId);
      if (action === "start") {
        const dep = await remoteStartDeployment(projectId);
        await mirror(projectId, dep);
        return res.json({ deployment: dep });
      }
      const dep = await remoteDeployProject(projectId, { projectSlug: project.slug });
      await mirror(projectId, dep);
      return res.status(202).json({ deployment: dep });
    }

    // ── DELETE — stop (?action=stop) or fully destroy the deployment ──────────────────────────────
    if (req.method === "DELETE") {
      if (action === "stop") {
        const dep = await remoteStopDeployment(projectId);
        await mirror(projectId, dep);
        return res.json({ deployment: dep });
      }
      await remoteDestroyDeployment(projectId);
      await mirror(projectId, null);
      return res.status(204).end();
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
