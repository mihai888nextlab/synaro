/** @jest-environment node */

import { describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/[agentId]";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/[agentId]", () => {
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

  it("proxies GET by agent id", async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ id: "agent-1", name: "Research" }), { status: 200 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(requestUrl(fetchMock().mock.calls[0][0] as string)).toBe(
      "http://agent-service.test/api/agents/agent-1",
    );
    expect(JSON.parse(res._getData() as string)).toEqual({ id: "agent-1", name: "Research" });
  });

  it("proxies PATCH with request body", async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ id: "agent-1", name: "Updated" }), { status: 200 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      query: { agentId: "agent-1" },
      body: { name: "Updated" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Updated" });
  });

  it("returns 204 on DELETE when upstream returns 204", async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(204);
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
