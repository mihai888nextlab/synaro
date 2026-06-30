import { normalizeGithubRepoUrl } from "@/lib/github-repo-url";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { touchProjectActivity } from "@/lib/project-activity";

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

export async function createProjectTask(
  projectId: string,
  userId: string,
  input: { prompt: string; mode?: "generate" | "answer" },
): Promise<{ task_id: string; status: string }> {
  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, userId),
    select: { id: true, cloneRepositoryUrl: true, slug: true },
  });
  if (!project) throw new Error("Project not found");

  touchProjectActivity(projectId);

  const githubToken = await getGithubAccessTokenForUser(userId);
  const payload: Record<string, unknown> = {
    projectId,
    prompt: input.prompt.trim(),
    projectSlug: project.slug,
    mode: input.mode === "answer" ? "answer" : "generate",
  };
  if (githubToken) {
    payload.git = {
      accessToken: githubToken,
      cloneRepositoryUrl: project.cloneRepositoryUrl?.trim() || null,
      authorName: "Synaro API",
      authorEmail: "synaro-api@users.noreply.github.com",
    };
  }

  const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await upstream.json()) as { id?: string; status?: string; error?: string };
  if (!upstream.ok) {
    throw new Error(data.error ?? `Task creation failed (${upstream.status})`);
  }
  return { task_id: data.id ?? "", status: data.status ?? "PENDING" };
}

export async function listProjectTasks(projectId: string, userId: string): Promise<unknown> {
  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, userId),
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const upstream = await fetch(
    `${aiServiceBaseUrl()}/api/tasks?projectId=${encodeURIComponent(projectId)}`,
  );
  const data = (await upstream.json()) as unknown;
  if (!upstream.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: string }).error)
        : `Task list failed (${upstream.status})`,
    );
  }
  return data;
}

export async function getProjectTask(
  taskId: string,
  userId: string,
  opts?: { wait?: boolean; timeoutSeconds?: number },
): Promise<{
  task_id: string;
  project_id: string;
  status: string;
  progress: string | null;
  summary: string | null;
  changes: unknown[];
  git: unknown;
  meta: unknown;
  error_message: string | null;
  stream_content: string | null;
  timed_out: boolean;
}> {
  const wait = opts?.wait !== false;
  const timeoutMs = Math.min(Math.max((opts?.timeoutSeconds ?? 300) * 1000, 5_000), 600_000);

  async function fetchTask(): Promise<RemoteTask> {
    const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`);
    const data = (await upstream.json()) as RemoteTask & { error?: string };
    if (!upstream.ok) throw new Error(data.error ?? `Task fetch failed (${upstream.status})`);
    return data;
  }

  const deadline = Date.now() + (wait ? timeoutMs : 0);
  let task = await fetchTask();

  const owned = await prisma.project.findFirst({
    where: whereProjectByIdForUser(task.projectId, userId),
    select: { id: true, cloneRepositoryUrl: true },
  });
  if (!owned) throw new Error("Task not found");

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

  return {
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
    timed_out:
      wait && task.status !== "DONE" && task.status !== "FAILED" && Date.now() >= deadline,
  };
}
