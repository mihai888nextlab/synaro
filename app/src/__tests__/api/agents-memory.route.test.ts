/** @jest-environment node */

import { describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/[agentId]/memory/index";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/[agentId]/memory", () => {
  const fetchMock = setupAgentServiceRouteTests();

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when agentId is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET", query: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("proxies GET with userId query param", async () => {
    fetchMock().mockResolvedValue(
      new Response(
        JSON.stringify([
          { key: "prefs", content: "dark mode", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
        ]),
        { status: 200 },
      ),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(requestUrl(fetchMock().mock.calls[0][0] as string)).toBe(
      "http://agent-service.test/api/agents/agent-1/memory?userId=user-1",
    );
    expect(JSON.parse(res._getData() as string)).toEqual([
      { key: "prefs", content: "dark mode", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
    ]);
  });

  it("proxies DELETE clear-all with userId in body", async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://agent-service.test/api/agents/agent-1/memory");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ userId: "user-1" });
  });

  it("returns 502 when agent service is unreachable", async () => {
    fetchMock().mockRejectedValue(new Error("ECONNREFUSED"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
