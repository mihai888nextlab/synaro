import { asCamel } from "./case.js";
import {
  errorFromResponse,
  parseRateLimitHeaders,
  type RateLimitInfo,
  type SynaroErrorBody,
  RateLimitError,
} from "./errors.js";

export type SynaroClientOptions = {
  apiKey: string;
  /** Origin only, e.g. https://synaro.tech or http://localhost:3000 */
  baseUrl?: string;
  /** Default timeout for CRUD calls (ms). */
  timeoutMs?: number;
  /** Retry once on HTTP 429. Default true. */
  retryOnRateLimit?: boolean;
  fetch?: typeof fetch;
  onRequest?: (info: { method: string; url: string }) => void;
  onResponse?: (info: {
    method: string;
    url: string;
    status: number;
    rateLimit: RateLimitInfo;
  }) => void;
};

export type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Convert JSON response from snake_case to camelCase. Default true. */
  camelResponse?: boolean;
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Expect empty body (204). */
  empty?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SynaroHttpClient {
  /** Kept private so callers cannot read the secret from `client.http`. */
  #apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly retryOnRateLimit: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly onRequest?: SynaroClientOptions["onRequest"];
  private readonly onResponse?: SynaroClientOptions["onResponse"];

  lastRateLimit: RateLimitInfo | null = null;

  constructor(opts: SynaroClientOptions) {
    const key = opts.apiKey?.trim();
    if (!key) throw new Error("apiKey is required");
    this.#apiKey = key;
    this.baseUrl = (opts.baseUrl ?? "https://synaro.tech").replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.retryOnRateLimit = opts.retryOnRateLimit !== false;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.onRequest = opts.onRequest;
    this.onResponse = opts.onResponse;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const url = this.buildUrl(path, options.query);
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    const attempt = async (): Promise<T> => {
      this.onRequest?.({ method, url });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.#apiKey}`,
        Accept: "application/json",
      };

      let body: string | undefined;
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
      }

      const res = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const rateLimit = parseRateLimitHeaders(res.headers);
      this.lastRateLimit = rateLimit;
      this.onResponse?.({ method, url, status: res.status, rateLimit });

      if (res.status === 204 || options.empty) {
        if (!res.ok) {
          const text = await res.text();
          let parsed: SynaroErrorBody = {};
          try {
            parsed = text ? (JSON.parse(text) as SynaroErrorBody) : {};
          } catch {
            parsed = { error: text || `HTTP ${res.status}` };
          }
          throw errorFromResponse(res.status, parsed, rateLimit);
        }
        return undefined as T;
      }

      const text = await res.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (!res.ok) {
        const errBody = (data ?? {}) as SynaroErrorBody;
        const retryAfterRaw = res.headers.get("retry-after");
        const retryAfterSec = retryAfterRaw != null ? Number(retryAfterRaw) : null;
        const err = errorFromResponse(
          res.status,
          errBody,
          rateLimit,
          Number.isFinite(retryAfterSec) ? retryAfterSec : null,
        );
        throw err;
      }

      if (options.camelResponse === false) return data as T;
      return asCamel<T>(data);
    };

    try {
      return await attempt();
    } catch (err) {
      if (
        this.retryOnRateLimit &&
        err instanceof RateLimitError &&
        (err.retryAfterSec == null || err.retryAfterSec <= 60)
      ) {
        const waitMs = Math.max(250, (err.retryAfterSec ?? 1) * 1000);
        await sleep(waitMs);
        return attempt();
      }
      throw err;
    }
  }
}
