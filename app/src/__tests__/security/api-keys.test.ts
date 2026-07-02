/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import { generateApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { resetPublicApiRateLimitStore } from "@/lib/public-api/rate-limit";
import { prisma } from "@/lib/prisma";
import meHandler from "@/pages/api/v1/me";
import projectsHandler from "@/pages/api/v1/projects/index";
import agentsHandler from "@/pages/api/v1/agents/index";
import { invokeRoute } from "@/testing/security-route-helpers";

jest.mock("@/lib/public-api/agent-proxy", () => ({
  proxyAgentService: jest.fn().mockResolvedValue({ status: 200, body: [] }),
}));

const findFirstApiKey = jest.mocked(prisma.apiKey.findFirst);
const findUniqueUser = jest.mocked(prisma.user.findUnique);

describe("security: public API key authentication", () => {
  const prevLimit = process.env.SYNARO_API_RATE_LIMIT;
  const prevWindow = process.env.SYNARO_API_RATE_WINDOW_SEC;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPublicApiRateLimitStore();
    process.env.SYNARO_API_RATE_LIMIT = "5";
    process.env.SYNARO_API_RATE_WINDOW_SEC = "60";
    findFirstApiKey.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.SYNARO_API_RATE_LIMIT = prevLimit;
    process.env.SYNARO_API_RATE_WINDOW_SEC = prevWindow;
    resetPublicApiRateLimitStore();
  });

  it.each([
    ["GET /api/v1/me", meHandler, { method: "GET" as const }],
    ["GET /api/v1/projects", projectsHandler, { method: "GET" as const }],
    ["GET /api/v1/agents", agentsHandler, { method: "GET" as const }],
  ])("%s returns 401 without Authorization header", async (_label, handler, options) => {
    const { res } = await invokeRoute(handler, options);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData() as string).error).toBe("unauthorized");
  });

  it.each([
    ["GET /api/v1/me", meHandler, { method: "GET" as const }],
    ["GET /api/v1/projects", projectsHandler, { method: "GET" as const }],
  ])("%s returns 401 for invalid bearer token", async (_label, handler, options) => {
    const { res } = await invokeRoute(handler, {
      ...options,
      headers: { authorization: "Bearer sk_live_not_a_real_key" },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData() as string).error).toBe("unauthorized");
    expect(findFirstApiKey).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey("sk_live_not_a_real_key"), revokedAt: null },
      select: { id: true, userId: true },
    });
  });

  it("returns 401 for revoked or unknown API key (findFirst miss)", async () => {
    const { raw } = generateApiKey();
    findFirstApiKey.mockResolvedValue(null);

    const { res } = await invokeRoute(meHandler, {
      method: "GET",
      headers: { authorization: `Bearer ${raw}` },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData() as string).error).toBe("unauthorized");
  });

  it("GET /api/v1/me succeeds with valid API key", async () => {
    const { raw } = generateApiKey();
    findFirstApiKey.mockResolvedValue({ id: "key-valid", userId: "user-1" });
    findUniqueUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { res } = await invokeRoute(meHandler, {
      method: "GET",
      headers: { authorization: `Bearer ${raw}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData() as string)).toEqual({
      user_id: "user-1",
      email: "user@example.com",
      name: "User",
      created_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("POST /api/v1/projects returns 401 without valid API key", async () => {
    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: { name: "Test" },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData() as string).error).toBe("unauthorized");
  });

  it("applies rate limit headers on authenticated public API requests", async () => {
    const { raw } = generateApiKey();
    findFirstApiKey.mockResolvedValue({ id: "key-rate", userId: "user-1" });
    findUniqueUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    process.env.SYNARO_API_RATE_LIMIT = "3";

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: `Bearer ${raw}` },
    });
    await meHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.getHeader("X-RateLimit-Limit")).toBe("3");
    expect(res.getHeader("X-RateLimit-Remaining")).toBe("2");
    expect(res.getHeader("X-RateLimit-Reset")).toBeTruthy();
  });

  it("returns 429 when public API rate limit is exceeded", async () => {
    const { raw } = generateApiKey();
    findFirstApiKey.mockResolvedValue({ id: "key-rate", userId: "user-1" });
    findUniqueUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    process.env.SYNARO_API_RATE_LIMIT = "1";

    const first = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: `Bearer ${raw}` },
    });
    await meHandler(first.req, first.res);
    expect(first.res.statusCode).toBe(200);

    const second = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: `Bearer ${raw}` },
    });
    await meHandler(second.req, second.res);

    expect(second.res.statusCode).toBe(429);
    expect(second.res.getHeader("Retry-After")).toBeTruthy();
    expect(JSON.parse(second.res._getData() as string).error).toBe("rate_limit_exceeded");
  });
});
