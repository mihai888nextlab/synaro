import type { SynaroHttpClient } from "../client.js";
import { NeedsInputError, SynaroError } from "../errors.js";
import { normalizeRun, normalizeRuns, runIdOf } from "../normalize.js";
import { pollUntil } from "../poll.js";
import type { AgentRun, WaitOptions, WatchOptions } from "../types.js";

const TERMINAL = new Set(["DONE", "FAILED", "CANCELLED"]);
const WATCH_DONE = new Set(["DONE", "FAILED", "CANCELLED", "NEEDS_INPUT"]);

export class RunsResource {
  constructor(private readonly http: SynaroHttpClient) {}

  async get(runId: string): Promise<AgentRun> {
    const raw = await this.http.request<unknown>(
      `/api/v1/runs/${encodeURIComponent(runId)}`,
    );
    return normalizeRun(raw);
  }

  cancel(runId: string): Promise<{ ok: boolean; runId: string }> {
    return this.http.request(`/api/v1/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      body: {},
    });
  }

  submitCredentials(
    runId: string,
    mcpAuth: Record<string, Record<string, string>>,
  ): Promise<unknown> {
    return this.http.request(`/api/v1/runs/${encodeURIComponent(runId)}/credentials`, {
      method: "POST",
      body: { mcpAuth },
    });
  }

  async active(): Promise<AgentRun[]> {
    const raw = await this.http.request<unknown>("/api/v1/runs/active");
    return normalizeRuns(raw);
  }

  async recent(opts?: { limit?: number }): Promise<AgentRun[]> {
    const raw = await this.http.request<unknown>("/api/v1/runs/recent", {
      query: { limit: opts?.limit },
    });
    return normalizeRuns(raw);
  }

  /**
   * Poll run status; yield each snapshot. Completes on DONE / FAILED / CANCELLED / NEEDS_INPUT
   * without throwing so `for await` can finish cleanly.
   */
  watch(runId: string, opts: WatchOptions = {}): AsyncGenerator<AgentRun, AgentRun, void> {
    const timeoutMs = opts.timeoutMs ?? 300_000;
    const pollIntervalMs = opts.pollIntervalMs ?? 2_000;

    return pollUntil<AgentRun>({
      fetch: () => this.get(runId),
      isDone: (run) => WATCH_DONE.has(String(run.status)),
      intervalMs: pollIntervalMs,
      timeoutMs,
      signal: opts.signal,
    });
  }

  async wait(runId: string, opts: WaitOptions = {}): Promise<AgentRun> {
    let last: AgentRun | undefined;
    for await (const run of this.watch(runId, {
      timeoutMs: opts.timeoutMs,
      pollIntervalMs: opts.pollIntervalMs,
      signal: opts.signal,
    })) {
      last = run;
      opts.onUpdate?.(run);
    }

    const run = last!;
    if (String(run.status) === "NEEDS_INPUT") {
      throw new NeedsInputError(runIdOf(run) || runId, run);
    }
    if (String(run.status) === "FAILED") {
      throw new SynaroError(String(run.output ?? `Run ${runId} failed`), 502, {
        error: "run_failed",
        detail: String(run.output ?? ""),
      });
    }
    if (!TERMINAL.has(String(run.status))) {
      throw new SynaroError(`Run ${runId} ended in unexpected status ${run.status}`, 502, {
        error: "run_unexpected_status",
      });
    }
    return run;
  }
}
