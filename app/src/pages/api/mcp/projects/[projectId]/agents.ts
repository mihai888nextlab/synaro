import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, userId),
    select: { id: true, cloneRepositoryUrl: true, slug: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const body = req.body as { prompt?: unknown; mode?: unknown };
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const githubToken = await getGithubAccessTokenForUser(userId);
  const payload: Record<string, unknown> = {
    projectId,
    prompt: body.prompt.trim(),
    projectSlug: project.slug,
    mode: body.mode === "answer" ? "answer" : "generate",
  };
  if (githubToken) {
    payload.git = {
      accessToken: githubToken,
      cloneRepositoryUrl: project.cloneRepositoryUrl?.trim() || null,
      authorName: "Synaro MCP",
      authorEmail: "synaro-mcp@users.noreply.github.com",
    };
  }

  try {
    const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await upstream.json()) as { id?: string; status?: string; error?: string };
    if (!upstream.ok) return res.status(upstream.status).json(data);
    return res.status(201).json({
      task_id: data.id,
      status: data.status ?? "PENDING",
      poll_with: "run_agent",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Could not reach AI service", detail: msg });
  }
}
