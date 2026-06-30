import type { NextApiRequest, NextApiResponse } from "next";

import { getSynaroSystemStatus } from "@/lib/mcp-system-status";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "GET")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId =
    typeof req.query.project_id === "string" ? req.query.project_id.trim() : undefined;

  if (projectId) {
    const visible = await prisma.project.findFirst({
      where: whereProjectByIdForUser(projectId, auth.userId),
      select: { id: true },
    });
    if (!visible) {
      return res.status(404).json({ error: "project_not_found" });
    }
  }

  try {
    const status = await getSynaroSystemStatus({
      projectId: projectId || undefined,
      userId: projectId ? auth.userId : undefined,
    });
    return res.status(200).json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "status_unavailable", detail: msg });
  }
}
