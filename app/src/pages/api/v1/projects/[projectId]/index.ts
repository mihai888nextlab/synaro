import type { NextApiRequest, NextApiResponse } from "next";

import { destroyAllRemoteEnvironmentsForProject } from "@/lib/environment-service-api";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { serializeProject } from "@/lib/public-api/serialize";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "DELETE"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "missing_project_id" });

  if (req.method === "GET") {
    const project = await prisma.project.findFirst({
      where: whereProjectByIdForUser(projectId, auth.userId),
    });
    if (!project) return res.status(404).json({ error: "project_not_found" });
    return res.status(200).json(serializeProject(project));
  }

  if (req.method === "DELETE") {
    const project = await prisma.project.findFirst({
      where: whereProjectByIdForUser(projectId, auth.userId),
      select: { id: true },
    });
    if (!project) return res.status(404).json({ error: "project_not_found" });

    await destroyAllRemoteEnvironmentsForProject(projectId);
    await prisma.project.delete({ where: { id: projectId } });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
