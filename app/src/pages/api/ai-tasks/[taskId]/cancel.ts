import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

type RemoteTask = {
  id: string;
  projectId: string;
  status: string;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = req.query.taskId;
  const taskId = typeof raw === "string" ? raw : "";
  if (!taskId) return res.status(400).json({ error: "Missing taskId" });

  try {
    const upstreamGet = await fetch(
      `${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`,
    );
    const existing = (await upstreamGet.json()) as RemoteTask;
    if (!upstreamGet.ok) return res.status(upstreamGet.status).json(existing);

    const owned = await prisma.project.findFirst({
      where: whereProjectByIdForUser(existing.projectId, session.user.id),
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Task not found" });

    const upstream = await fetch(
      `${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/cancel`,
      { method: "POST" },
    );
    const data = (await upstream.json()) as RemoteTask;
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach AI service" });
  }
}
