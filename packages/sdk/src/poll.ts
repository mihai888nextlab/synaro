import { SynaroError } from "./errors.js";

export type PollUntilOptions<T> = {
  fetch: () => Promise<T>;
  isDone: (value: T) => boolean;
  intervalMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Yield each poll snapshot; return the final value when `isDone` is true.
 * Throws SynaroError(504) on timeout.
 */
export async function* pollUntil<T>(
  opts: PollUntilOptions<T>,
): AsyncGenerator<T, T, void> {
  const deadline = Date.now() + opts.timeoutMs;
  let value = await opts.fetch();
  yield value;

  while (!opts.isDone(value)) {
    if (opts.signal?.aborted) {
      throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    if (Date.now() >= deadline) {
      throw new SynaroError(`Polling timed out after ${opts.timeoutMs}ms`, 504, {
        error: "poll_timed_out",
      });
    }
    await sleep(opts.intervalMs, opts.signal);
    value = await opts.fetch();
    yield value;
  }

  return value;
}
