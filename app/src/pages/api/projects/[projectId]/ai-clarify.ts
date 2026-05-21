import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const raw = req.query.projectId;
  const projectId = typeof raw === "string" ? raw : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" });

  try {
    const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks/clarify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    // If clarification fails, return empty questions so the frontend falls back to direct generation
    return res.json({ questions: [] });
  }
}
