import type { NextApiResponse } from "next";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: number;
};

type WindowState = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, WindowState>();

function readLimit(): number {
  const raw = process.env.SYNARO_API_RATE_LIMIT?.trim();
  const n = raw ? Number(raw) : 120;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

/**
 * An explicitly-configured `SYNARO_API_RATE_LIMIT`, or null if unset/invalid.
 * When set it acts as a global cap across all tiers (ops safety valve); when
 * unset the per-tier limit applies unchanged.
 */
export function explicitConfiguredLimit(): number | null {
  const raw = process.env.SYNARO_API_RATE_LIMIT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function readWindowMs(): number {
  const raw = process.env.SYNARO_API_RATE_WINDOW_SEC?.trim();
  const sec = raw ? Number(raw) : 60;
  const ms = Number.isFinite(sec) && sec > 0 ? sec * 1000 : 60_000;
  return Math.min(Math.max(ms, 1_000), 3_600_000);
}

/**
 * Fixed-window counter per API key id. `limitOverride` (e.g. the caller's per-tier
 * requests/min) takes precedence over the env-configured default.
 */
export function checkPublicApiRateLimit(
  apiKeyId: string,
  now = Date.now(),
  limitOverride?: number,
): RateLimitResult {
  const limit =
    typeof limitOverride === "number" && Number.isFinite(limitOverride) && limitOverride > 0
      ? Math.floor(limitOverride)
      : readLimit();
  const windowMs = readWindowMs();
  const bucketKey = `key:${apiKeyId}`;

  let state = buckets.get(bucketKey);
  if (!state || now - state.windowStart >= windowMs) {
    state = { count: 0, windowStart: now };
    buckets.set(bucketKey, state);
  }

  const reset_at = state.windowStart + windowMs;

  if (state.count >= limit) {
    return { allowed: false, limit, remaining: 0, reset_at };
  }

  state.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - state.count, 0),
    reset_at,
  };
}

export function applyRateLimitHeaders(res: NextApiResponse, result: RateLimitResult): void {
  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.reset_at / 1000)));
}

export function applyRetryAfterHeader(res: NextApiResponse, result: RateLimitResult, now = Date.now()): void {
  const seconds = Math.max(1, Math.ceil((result.reset_at - now) / 1000));
  res.setHeader("Retry-After", String(seconds));
}

/** Test helper — clears in-memory counters. */
export function resetPublicApiRateLimitStore(): void {
  buckets.clear();
}
