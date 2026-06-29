/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import handler from "@/pages/api/agents/index";

const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

const origFetch = globalThis.fetch;
const origAgentKey = process.env.AGENT_SERVICE_KEY;
const origAgentUrl = process.env.AGENT_SERVICE_URL;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("API /api/agents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENT_SERVICE_KEY = "test-agent-key";
    process.env.AGENT_SERVICE_URL = "http://agent-service.test";
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.AGENT_SERVICE_KEY = origAgentKey;
    process.env.AGENT_SERVICE_URL = origAgentUrl;
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("proxies GET with userId and service key header", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify([{ id: "a1", name: "Research" }]), { status: 200 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl(url)).toBe("http://agent-service.test/api/agents?userId=user-1");
    expect((init.headers as Record<string, string>)["X-Service-Key"]).toBe("test-agent-key");
    expect(JSON.parse(res._getData() as string)).toEqual([{ id: "a1", name: "Research" }]);
  });

  it("returns 502 when agent service is unreachable", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res._getData() as string).error).toMatch(/agent service/i);
  });

  it("returns 405 for unsupported methods", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
