import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { cloneDemoProject } from "@/lib/admin/clone-demo-project";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const body = req.body as { sourceProjectId?: string; targetUserId?: string; cloneAgents?: boolean };
  if (!body.sourceProjectId || !body.targetUserId) {
    return res.status(400).json({ error: "sourceProjectId and targetUserId are required" });
  }

  // The source project must belong to the admin running this.
  const source = await prisma.project.findFirst({
    where: { id: body.sourceProjectId, userId: adminId },
    select: { id: true },
  });
  if (!source) return res.status(404).json({ error: "Source project not found (must be one of yours)" });

  const target = await prisma.user.findUnique({ where: { id: body.targetUserId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "Target account not found" });

  try {
    const result = await cloneDemoProject({
      sourceProjectId: body.sourceProjectId,
      targetUserId: body.targetUserId,
      cloneAgents: body.cloneAgents !== false,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
