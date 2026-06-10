import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
} from "@/lib/environment-service-api";
import {
  terminalCreateWorkspaceDirectory,
  terminalDeleteWorkspacePath,
  terminalRenameWorkspacePath,
  terminalWriteWorkspaceFile,
} from "@/lib/workspace-terminal-fs";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type MutateBody =
  | { action: "createFile"; path: string; content?: string }
  | { action: "createFolder"; path: string }
  | { action: "delete"; path: string }
  | { action: "rename"; from: string; to: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true } | { error: string; detail?: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const body = req.body as MutateBody;

  if (!projectId || !body || typeof body.action !== "string") {
    res.status(400).json({ error: "Missing projectId or action" });
    return;
  }

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  try {
    const rows = await fetchEnvironmentsForProject(projectId);
    const active = pickActiveRuntimeEnvironment(rows);
    if (!active?.id) {
      res.status(409).json({ error: "No active runtime environment" });
      return;
    }

    switch (body.action) {
      case "createFile": {
        const path = typeof body.path === "string" ? body.path.trim() : "";
        if (!path) {
          res.status(400).json({ error: "Missing path" });
          return;
        }
        const content = typeof body.content === "string" ? body.content : "";
        await terminalWriteWorkspaceFile(active.id, path, content);
        break;
      }
      case "createFolder": {
        const path = typeof body.path === "string" ? body.path.trim() : "";
        if (!path) {
          res.status(400).json({ error: "Missing path" });
          return;
        }
        await terminalCreateWorkspaceDirectory(active.id, path);
        break;
      }
      case "delete": {
        const path = typeof body.path === "string" ? body.path.trim() : "";
        if (!path) {
          res.status(400).json({ error: "Missing path" });
          return;
        }
        await terminalDeleteWorkspacePath(active.id, path);
        break;
      }
      case "rename": {
        const from = typeof body.from === "string" ? body.from.trim() : "";
        const to = typeof body.to === "string" ? body.to.trim() : "";
        if (!from || !to) {
          res.status(400).json({ error: "Missing from or to path" });
          return;
        }
        await terminalRenameWorkspacePath(active.id, from, to);
        break;
      }
      default:
        res.status(400).json({ error: "Unknown action" });
        return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Workspace mutation failed", detail: msg });
  }
}
