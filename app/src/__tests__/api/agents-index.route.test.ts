/** @jest-environment node */

import { describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/index";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents", () => {
  const fetchMock = setupAgentServiceRouteTests();

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("proxies GET with userId and service key header", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify([{ id: "a1", name: "Research" }]), { status: 200 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [url, init] = fetchMock().mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(requestUrl(url)).toBe("http://agent-service.test/api/agents?userId=user-1");
    expect((init.headers as Record<string, string>)["X-Service-Key"]).toBe("test-agent-key");
    expect(JSON.parse(res._getData() as string)).toEqual([{ id: "a1", name: "Research" }]);
  });

  it("returns 502 when agent service is unreachable", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    fetchMock().mockRejectedValue(new Error("ECONNREFUSED"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res._getData() as string).error).toMatch(/agent service/i);
  });

  it("proxies POST with userId merged into body", async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ id: "a1", name: "Research" }), { status: 201 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Research", prompt: "Find papers" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(requestUrl(url)).toBe("http://agent-service.test/api/agents");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Research",
      prompt: "Find papers",
      userId: "user-1",
    });
    expect(JSON.parse(res._getData() as string)).toEqual({ id: "a1", name: "Research" });
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
