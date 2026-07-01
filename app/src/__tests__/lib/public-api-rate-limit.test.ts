import {
  checkPublicApiRateLimit,
  resetPublicApiRateLimitStore,
} from "@/lib/public-api/rate-limit";

describe("public-api-rate-limit", () => {
  const prevLimit = process.env.SYNARO_API_RATE_LIMIT;
  const prevWindow = process.env.SYNARO_API_RATE_WINDOW_SEC;

  beforeEach(() => {
    resetPublicApiRateLimitStore();
    process.env.SYNARO_API_RATE_LIMIT = "3";
    process.env.SYNARO_API_RATE_WINDOW_SEC = "60";
  });

  afterEach(() => {
    process.env.SYNARO_API_RATE_LIMIT = prevLimit;
    process.env.SYNARO_API_RATE_WINDOW_SEC = prevWindow;
    resetPublicApiRateLimitStore();
  });

  it("allows requests up to the limit", () => {
    const t0 = 1_700_000_000_000;
    expect(checkPublicApiRateLimit("key-1", t0)).toMatchObject({
      allowed: true,
      limit: 3,
      remaining: 2,
    });
    expect(checkPublicApiRateLimit("key-1", t0 + 1)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkPublicApiRateLimit("key-1", t0 + 2)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it("blocks requests over the limit in the same window", () => {
    const t0 = 1_700_000_000_000;
    checkPublicApiRateLimit("key-1", t0);
    checkPublicApiRateLimit("key-1", t0);
    checkPublicApiRateLimit("key-1", t0);

    const blocked = checkPublicApiRateLimit("key-1", t0 + 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reset_at).toBe(t0 + 60_000);
  });

  it("resets the counter when the window expires", () => {
    const t0 = 1_700_000_000_000;
    checkPublicApiRateLimit("key-1", t0);
    checkPublicApiRateLimit("key-1", t0);
    checkPublicApiRateLimit("key-1", t0);
    expect(checkPublicApiRateLimit("key-1", t0 + 100).allowed).toBe(false);

    const afterWindow = checkPublicApiRateLimit("key-1", t0 + 60_001);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(2);
  });

  it("tracks keys independently", () => {
    const t0 = 1_700_000_000_000;
    checkPublicApiRateLimit("key-a", t0);
    checkPublicApiRateLimit("key-a", t0);
    checkPublicApiRateLimit("key-a", t0);
    expect(checkPublicApiRateLimit("key-a", t0).allowed).toBe(false);
    expect(checkPublicApiRateLimit("key-b", t0).allowed).toBe(true);
  });
});
