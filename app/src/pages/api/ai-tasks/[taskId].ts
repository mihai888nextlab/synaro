import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { normalizeGithubRepoUrl } from "@/lib/github-repo-url";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

type RemoteTask = {
  id: string;
  projectId: string;
  status: string;
  result?: {
    linkedCloneRepositoryUrl?: string;
    git?: { htmlUrl?: string };
  } | null;
};

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
    const data = (await upstream.json()) as RemoteTask & { error?: string };
    if (!upstream.ok) return res.status(upstream.status).json(data);

    if (data.status === "DONE" && data.result?.linkedCloneRepositoryUrl) {
      const normalized = normalizeGithubRepoUrl(data.result.linkedCloneRepositoryUrl);
      if (normalized) {
        const owned = await prisma.project.findFirst({
          where: whereProjectByIdForUser(data.projectId, session.user.id),
          select: { id: true, cloneRepositoryUrl: true },
        });
        if (owned && !owned.cloneRepositoryUrl?.trim()) {
          await prisma.project.update({
            where: { id: owned.id },
            data: { cloneRepositoryUrl: normalized },
          });
        }
      }
    }

    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach AI service" });
  }
}
