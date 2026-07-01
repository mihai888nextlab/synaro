/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/[agentId]/runs";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/[agentId]/runs", () => {
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

  it("proxies GET runs list", async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify([{ id: "run-1", status: "completed" }]), { status: 200 }),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(requestUrl(fetchMock().mock.calls[0][0] as string)).toBe(
      "http://agent-service.test/api/agents/agent-1/runs",
    );
    expect(JSON.parse(res._getData() as string)).toEqual([{ id: "run-1", status: "completed" }]);
  });

  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._getHeaders().allow).toBe("GET");
  });
});
