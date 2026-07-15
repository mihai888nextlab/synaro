const buckets = new Map<string, number[]>();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

export function checkAuthEmailRateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_REQUESTS) return false;
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function resetAuthEmailRateLimitForTests(): void {
  buckets.clear();
}
