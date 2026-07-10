/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// Billing enforcement is exercised in the billing unit tests; here it is transparent.
jest.mock("@/lib/billing/get-user-entitlements", () => ({
  getUserEntitlements: jest.fn().mockResolvedValue({ gated: false }),
}));
jest.mock("@/lib/billing/usage", () => ({
  reserveAgentRun: jest.fn().mockResolvedValue({ ok: true }),
  releaseAgentRun: jest.fn().mockResolvedValue(undefined),
}));

import handler from "@/pages/api/agents/[agentId]/trigger";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/[agentId]/trigger", () => {
  const fetchMock = setupAgentServiceRouteTests();

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when agentId is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST", query: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("proxies POST trigger with body", async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ runId: "run-1", status: "queued" }), { status: 202 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
      body: { input: "hello" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(202);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(requestUrl(url)).toBe("http://agent-service.test/api/agents/agent-1/trigger");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ input: "hello" });
    expect(JSON.parse(res._getData() as string)).toEqual({ runId: "run-1", status: "queued" });
  });

  it("returns 405 for non-POST methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._getHeaders().allow).toBe("POST");
  });

  it("returns 502 when agent service is unreachable", async () => {
    fetchMock().mockRejectedValue(new Error("ECONNREFUSED"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(502);
  });
});
