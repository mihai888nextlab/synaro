import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
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
  progress?: string | null;
  streamContent?: string | null;
  errorMessage?: string | null;
  result?: {
    summary?: string;
    changes?: unknown[];
    git?: { htmlUrl?: string; branch?: string };
    meta?: { exploredFiles?: number; aiSteps?: number };
    linkedCloneRepositoryUrl?: string;
  } | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const taskId = typeof req.query.taskId === "string" ? req.query.taskId : "";
  if (!taskId) return res.status(400).json({ error: "Missing taskId" });

  const wait = req.query.wait !== "false";
  const timeoutRaw =
    typeof req.query.timeout_seconds === "string" ? Number(req.query.timeout_seconds) : 300;
  const timeoutMs = Math.min(Math.max(timeoutRaw * 1000, 5_000), 600_000);

  async function fetchTask(): Promise<RemoteTask> {
    const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`);
    const data = (await upstream.json()) as RemoteTask & { error?: string };
    if (!upstream.ok) throw new Error(data.error ?? `Task fetch failed (${upstream.status})`);
    return data;
  }

  try {
    const deadline = Date.now() + (wait ? timeoutMs : 0);
    let task = await fetchTask();

    const owned = await prisma.project.findFirst({
      where: whereProjectByIdForUser(task.projectId, userId),
      select: { id: true, cloneRepositoryUrl: true },
    });
    if (!owned) return res.status(404).json({ error: "Task not found" });

    while (wait && task.status !== "DONE" && task.status !== "FAILED" && Date.now() < deadline) {
      await sleep(1_500);
      task = await fetchTask();
    }

    if (task.status === "DONE" && task.result?.linkedCloneRepositoryUrl) {
      const normalized = normalizeGithubRepoUrl(task.result.linkedCloneRepositoryUrl);
      if (normalized && !owned.cloneRepositoryUrl?.trim()) {
        await prisma.project.update({
          where: { id: owned.id },
          data: { cloneRepositoryUrl: normalized },
        });
      }
    }

    return res.status(200).json({
      task_id: task.id,
      project_id: task.projectId,
      status: task.status,
      progress: task.progress ?? null,
      summary: task.result?.summary ?? null,
      changes: task.result?.changes ?? [],
      git: task.result?.git ?? null,
      meta: task.result?.meta ?? null,
      error_message: task.errorMessage ?? null,
      stream_content: task.streamContent ?? null,
      timed_out: wait && task.status !== "DONE" && task.status !== "FAILED" && Date.now() >= deadline,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: msg });
  }
}
