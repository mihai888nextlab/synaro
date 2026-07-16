import { toSnakeCase } from "../case.js";
import type { SynaroHttpClient } from "../client.js";
import { SynaroError } from "../errors.js";
import { pollUntil } from "../poll.js";
import type {
  CreateTaskInput,
  CreateTaskResult,
  GetTaskOptions,
  TaskResult,
  WatchOptions,
} from "../types.js";

const TERMINAL = new Set([
  "DONE",
  "FAILED",
  "CANCELLED",
  "ERROR",
  "COMPLETED",
  "SUCCESS",
]);

function isTaskTerminal(task: TaskResult): boolean {
  if (task.timedOut) return true;
  const status = String(task.status ?? "").toUpperCase();
  return TERMINAL.has(status);
}

export class TasksResource {
  constructor(private readonly http: SynaroHttpClient) {}

  create(projectId: string, input: CreateTaskInput): Promise<CreateTaskResult> {
    return this.http.request<CreateTaskResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/tasks`,
      {
        method: "POST",
        body: toSnakeCase({
          prompt: input.prompt,
          mode: input.mode ?? "generate",
        }),
      },
    );
  }

  list(projectId: string): Promise<unknown> {
    return this.http.request(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`);
  }

  get(taskId: string, opts: GetTaskOptions = {}): Promise<TaskResult> {
    const wait = opts.wait !== false;
    const timeoutSeconds = opts.timeoutSeconds ?? 300;
    return this.http.request<TaskResult>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      query: {
        wait: wait ? undefined : "false",
        timeout_seconds: timeoutSeconds,
      },
      timeoutMs: wait ? (timeoutSeconds + 30) * 1000 : this.http.timeoutMs,
    });
  }

  /**
   * Poll task status with `wait=false`; yield each snapshot until terminal.
   */
  watch(taskId: string, opts: WatchOptions = {}): AsyncGenerator<TaskResult, TaskResult, void> {
    const timeoutMs = opts.timeoutMs ?? 300_000;
    const pollIntervalMs = opts.pollIntervalMs ?? 2_000;

    return pollUntil<TaskResult>({
      fetch: () => this.get(taskId, { wait: false, timeoutSeconds: 30 }),
      isDone: isTaskTerminal,
      intervalMs: pollIntervalMs,
      timeoutMs,
      signal: opts.signal,
    });
  }

  /**
   * Create a task and wait until it reaches a terminal status.
   * Throws SynaroError if the task failed.
   */
  async run(
    projectId: string,
    prompt: string,
    opts?: Omit<CreateTaskInput, "prompt"> & GetTaskOptions,
  ): Promise<TaskResult> {
    const created = await this.create(projectId, {
      prompt,
      mode: opts?.mode,
    });
    const result = await this.get(created.taskId, {
      wait: opts?.wait !== false,
      timeoutSeconds: opts?.timeoutSeconds,
    });

    const status = String(result.status ?? "").toUpperCase();
    if (status === "FAILED" || status === "ERROR" || result.errorMessage) {
      throw new SynaroError(result.errorMessage ?? `Task ${created.taskId} failed`, 502, {
        error: "task_failed",
        detail: result.errorMessage ?? status,
      });
    }
    if (result.timedOut) {
      throw new SynaroError(`Task ${created.taskId} timed out`, 504, {
        error: "task_timed_out",
      });
    }
    return result;
  }
}
