import type { AiRemoteTask, AiTaskStatus, TaskResult } from "@/lib/ai-task-types";

export type { TaskResult } from "@/lib/ai-task-types";

export function taskPollFingerprint(task: AiRemoteTask): string {
  const result = task.result as TaskResult | null | undefined;
  return [
    task.status,
    task.progress ?? "",
    task.streamContent ?? "",
    result?.summary ?? "",
    task.errorMessage ?? "",
  ].join("\x1e");
}

export function resolveTaskAnswerContent(
  task: AiRemoteTask,
  prevContent: string,
): string | undefined {
  const result = task.result as TaskResult | null | undefined;
  const streamChunk = typeof task.streamContent === "string" ? task.streamContent : "";
  const liveContent = streamChunk.length >= prevContent.length ? streamChunk : prevContent;

  if (task.status === "DONE" && result?.summary) return result.summary;
  if (task.status === "FAILED") return task.errorMessage ?? "Task failed";
  if (liveContent.length > 0) return liveContent;
  return prevContent || undefined;
}

export function isTerminalTaskStatus(status: AiTaskStatus | undefined) {
  return status === "DONE" || status === "FAILED";
}
