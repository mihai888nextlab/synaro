import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { applyDynamicApiNoCacheHeaders } from "@/lib/apply-dynamic-api-no-cache";
import { destroyAllRemoteEnvironmentsForProject, remoteDestroyDeployment } from "@/lib/environment-service-api";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type ProjectPayload = {
  name?: string;
  description?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error?: string; detail?: string; project?: { id: string; name: string; description: string | null } }>,
) {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";

  if (req.method !== "DELETE" && req.method !== "PATCH") {
    res.setHeader("Allow", "DELETE, PATCH");
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

    if (req.method === "PATCH") {
      const body = req.body as ProjectPayload;
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: {
          name: body.name.trim(),
          description: typeof body.description === "string" ? body.description.trim() || null : null,
        },
      });
      res.status(200).json({
        project: { id: updated.id, name: updated.name, description: updated.description },
      });
      return;
    }

    await destroyAllRemoteEnvironmentsForProject(projectId);
    // Also tear down the production deployment (container + snapshot volume), best-effort.
    await remoteDestroyDeployment(projectId).catch(() => {});
    await prisma.project.delete({ where: { id: projectId } });
    res.status(204).end();
  } catch (err) {
    const label = req.method === "DELETE" ? "DELETE" : "PATCH";
    console.error(`[api/projects/[projectId] ${label}]`, err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to ${req.method === "DELETE" ? "delete" : "update"} project`,
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}
