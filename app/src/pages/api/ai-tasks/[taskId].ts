import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const raw = req.query.taskId;
  const taskId = typeof raw === "string" ? raw : "";
  if (!taskId) return res.status(400).json({ error: "Missing taskId" });

  try {
    const upstream = await fetch(
      `${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`,
    );
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach AI service" });
  }
}
