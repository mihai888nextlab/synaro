import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const raw = req.query.projectId;
  const projectId = typeof raw === "string" ? raw : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true, cloneRepositoryUrl: true, slug: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  if (req.method === "POST") {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) return res.status(400).json({ error: "prompt is required" });

    const githubToken = await getGithubAccessTokenForUser(session.user.id);
    const authorName =
      (typeof session.user.name === "string" && session.user.name.trim()) || "Synaro User";
    const authorEmail =
      (typeof session.user.email === "string" && session.user.email.trim()) ||
      "synaro@users.noreply.github.com";

    const payload: Record<string, unknown> = {
      projectId,
      prompt: prompt.trim(),
      projectSlug: project.slug,
    };
    if (githubToken) {
      payload.git = {
        accessToken: githubToken,
        cloneRepositoryUrl: project.cloneRepositoryUrl?.trim() || null,
        authorName,
        authorEmail,
      };
    }

    try {
      const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await upstream.json()) as unknown;
      return res.status(upstream.status).json(data);
    } catch {
      return res.status(502).json({ error: "Could not reach AI service" });
    }
  }

  if (req.method === "GET") {
    try {
      const upstream = await fetch(
        `${aiServiceBaseUrl()}/api/tasks?projectId=${encodeURIComponent(projectId)}`,
      );
      const data = (await upstream.json()) as unknown;
      return res.status(upstream.status).json(data);
    } catch {
      return res.status(502).json({ error: "Could not reach AI service" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
