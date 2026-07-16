export type SynaroErrorBody = {
  error?: string;
  detail?: string;
  limit?: number;
  reset_at?: number;
  [key: string]: unknown;
};

export class SynaroError extends Error {
  readonly status: number;
  readonly body: SynaroErrorBody;
  readonly rateLimit?: RateLimitInfo;

  constructor(
    message: string,
    status: number,
    body: SynaroErrorBody = {},
    rateLimit?: RateLimitInfo,
  ) {
    super(message);
    this.name = "SynaroError";
    this.status = status;
    this.body = body;
    this.rateLimit = rateLimit;
  }
}

export class AuthError extends SynaroError {
  constructor(message: string, body: SynaroErrorBody = {}, rateLimit?: RateLimitInfo) {
    super(message, 401, body, rateLimit);
    this.name = "AuthError";
  }
}

export class NotFoundError extends SynaroError {
  constructor(message: string, body: SynaroErrorBody = {}, rateLimit?: RateLimitInfo) {
    super(message, 404, body, rateLimit);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends SynaroError {
  constructor(message: string, body: SynaroErrorBody = {}, rateLimit?: RateLimitInfo) {
    super(message, 409, body, rateLimit);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends SynaroError {
  readonly retryAfterSec: number | null;

  constructor(
    message: string,
    body: SynaroErrorBody = {},
    rateLimit?: RateLimitInfo,
    retryAfterSec: number | null = null,
  ) {
    super(message, 429, body, rateLimit);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class NeedsInputError extends SynaroError {
  readonly runId: string;
  readonly run: unknown;

  constructor(runId: string, run: unknown) {
    super("Agent run needs MCP credentials (NEEDS_INPUT)", 409, {
      error: "needs_input",
      detail: "Submit credentials via runs.submitCredentials",
    });
    this.name = "NeedsInputError";
    this.runId = runId;
    this.run = run;
  }
}

export type RateLimitInfo = {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
};

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const num = (name: string) => {
    const raw = headers.get(name);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return {
    limit: num("x-ratelimit-limit"),
    remaining: num("x-ratelimit-remaining"),
    reset: num("x-ratelimit-reset"),
  };
}

export function errorFromResponse(
  status: number,
  body: SynaroErrorBody,
  rateLimit?: RateLimitInfo,
  retryAfterSec: number | null = null,
): SynaroError {
  const message = body.detail ?? body.error ?? `HTTP ${status}`;
  if (status === 401) return new AuthError(message, body, rateLimit);
  if (status === 404) return new NotFoundError(message, body, rateLimit);
  if (status === 409) return new ConflictError(message, body, rateLimit);
  if (status === 429) return new RateLimitError(message, body, rateLimit, retryAfterSec);
  return new SynaroError(message, status, body, rateLimit);
}
