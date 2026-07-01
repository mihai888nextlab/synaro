import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";

import { generateApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { resolvePublicApiAuth, requirePublicApiAuth } from "@/lib/public-api-auth";
import { resetPublicApiRateLimitStore } from "@/lib/public-api/rate-limit";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

function mockReq(auth?: string): NextApiRequest {
  return {
    headers: auth ? { authorization: auth } : {},
  } as NextApiRequest;
}

describe("public-api-auth", () => {
  const findFirst = prisma.apiKey.findFirst as jest.Mock;
  const prevLimit = process.env.SYNARO_API_RATE_LIMIT;
  const prevWindow = process.env.SYNARO_API_RATE_WINDOW_SEC;

  beforeEach(() => {
    findFirst.mockReset();
    resetPublicApiRateLimitStore();
    process.env.SYNARO_API_RATE_LIMIT = "2";
    process.env.SYNARO_API_RATE_WINDOW_SEC = "60";
  });

  afterEach(() => {
    process.env.SYNARO_API_RATE_LIMIT = prevLimit;
    process.env.SYNARO_API_RATE_WINDOW_SEC = prevWindow;
    resetPublicApiRateLimitStore();
  });

  it("returns user id for valid bearer token", async () => {
    const { raw } = generateApiKey();
    findFirst.mockResolvedValue({ id: "key-1", userId: "user-123" });

    const auth = await resolvePublicApiAuth(mockReq(`Bearer ${raw}`));
    expect(auth).toEqual({ userId: "user-123", apiKeyId: "key-1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey(raw), revokedAt: null },
      select: { id: true, userId: true },
    });
  });

  it("rejects missing or wrong token", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolvePublicApiAuth(mockReq())).toBeNull();
    expect(await resolvePublicApiAuth(mockReq("Bearer wrong"))).toBeNull();
  });

  it("applies rate limit headers and returns 429 when exceeded", async () => {
    const { raw } = generateApiKey();
    findFirst.mockResolvedValue({ id: "key-1", userId: "user-123" });

    const first = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${raw}` },
    });
    const auth1 = await requirePublicApiAuth(first.req, first.res);
    expect(auth1).not.toBeNull();
    expect(first.res.getHeader("X-RateLimit-Limit")).toBe("2");
    expect(first.res.getHeader("X-RateLimit-Remaining")).toBe("1");

    const second = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${raw}` },
    });
    const auth2 = await requirePublicApiAuth(second.req, second.res);
    expect(auth2).not.toBeNull();
    expect(second.res.getHeader("X-RateLimit-Remaining")).toBe("0");

    const third = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${raw}` },
    });
    const auth3 = await requirePublicApiAuth(third.req, third.res);
    expect(auth3).toBeNull();
    expect(third.res.statusCode).toBe(429);
    expect(third.res.getHeader("Retry-After")).toBeTruthy();
    expect(JSON.parse(third.res._getData() as string).error).toBe("rate_limit_exceeded");
  });
});
