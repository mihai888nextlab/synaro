import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { applyDynamicApiNoCacheHeaders } from "@/lib/apply-dynamic-api-no-cache";
import { destroyAllRemoteEnvironmentsForProject } from "@/lib/environment-service-api";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ error?: string; detail?: string }>) {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    res.status(405).end();
    return;
  }

  applyDynamicApiNoCacheHeaders(res);

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await destroyAllRemoteEnvironmentsForProject(projectId);
    await prisma.project.delete({ where: { id: projectId } });
    res.status(204).end();
  } catch (err) {
    console.error("[api/projects/[projectId] DELETE]", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Failed to delete project",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}
