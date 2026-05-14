import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteListWorkspaceFiles,
} from "@/lib/environment-service-api";
import type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

export type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";

async function syncProjectStopped(projectId: string) {
  await prisma.project
    .update({
      where: { id: projectId },
      data: { environmentStatus: "STOPPED", repositoryLocation: null },
    })
    .catch(() => {
      /* ignore missing / race */
    });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkspaceFilesResponse | { error: string; detail?: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!projectId) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  try {
    const rows = await fetchEnvironmentsForProject(projectId);
    if (rows.length === 0) {
      res.status(200).json({
        paths: [],
        truncated: false,
        rootLabel: "repository",
        reason: "no_environment",
      });
      return;
    }

    const active = pickActiveRuntimeEnvironment(rows);
    if (!active?.id) {
      await syncProjectStopped(projectId);
      res.status(200).json({
        paths: [],
        truncated: false,
        rootLabel: "repository",
        reason: "not_active",
      });
      return;
    }

    const remote = await remoteListWorkspaceFiles(active.id);
    if (remote.inactive) {
      await syncProjectStopped(projectId);
      res.status(200).json({
        paths: [],
        truncated: false,
        rootLabel: remote.rootLabel,
        reason: "not_active",
      });
      return;
    }
    if (remote.clonePending) {
      res.status(200).json({
        paths: [],
        truncated: false,
        rootLabel: remote.rootLabel,
        reason: "clone_pending",
      });
      return;
    }
    res.status(200).json({
      paths: remote.paths,
      truncated: remote.truncated,
      rootLabel: remote.rootLabel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(200).json({
      paths: [],
      truncated: false,
      rootLabel: "repository",
      reason: "unreachable",
      detail: msg,
    });
  }
}
