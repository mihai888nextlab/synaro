import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteWriteWorkspaceFile,
} from "@/lib/environment-service-api";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

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
  const { path, content } = req.body as { path?: unknown; content?: unknown };

  if (!projectId || typeof path !== "string" || !path.trim()) {
    res.status(400).json({ error: "Missing projectId or path" });
    return;
  }
  if (typeof content !== "string") {
    res.status(400).json({ error: "content must be a string" });
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

    await remoteWriteWorkspaceFile(active.id, path.trim(), content);
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to write file", detail: msg });
  }
}
