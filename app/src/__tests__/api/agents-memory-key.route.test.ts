/** @jest-environment node */

import { describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/[agentId]/memory/[key]";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/[agentId]/memory/[key]", () => {
  const fetchMock = setupAgentServiceRouteTests();

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { agentId: "agent-1", key: "prefs" },
      body: { content: "dark mode" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when key is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { agentId: "agent-1" },
      body: { content: "dark mode" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("proxies PUT upsert with encoded key and userId", async () => {
    fetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          key: "user prefs",
          content: "dark mode",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        }),
        { status: 200 },
      ),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { agentId: "agent-1", key: "user prefs" },
      body: { content: "dark mode" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(requestUrl(fetchMock().mock.calls[0][0] as string)).toBe(
      "http://agent-service.test/api/agents/agent-1/memory/user%20prefs",
    );
    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ userId: "user-1", content: "dark mode" });
  });

  it("proxies DELETE one entry with encoded key", async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1", key: "prefs" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(204);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://agent-service.test/api/agents/agent-1/memory/prefs");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ userId: "user-1" });
  });

  it("returns 502 when agent service is unreachable", async () => {
    fetchMock().mockRejectedValue(new Error("ECONNREFUSED"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1", key: "prefs" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1", key: "prefs" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
