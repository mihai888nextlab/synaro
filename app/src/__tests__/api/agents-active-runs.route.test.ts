/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/agents/active-runs";
import {
  getServerSessionMock,
  requestUrl,
  setupAgentServiceRouteTests,
} from "@/testing/agents-route-test-helpers";

describe("API /api/agents/active-runs", () => {
  const fetchMock = setupAgentServiceRouteTests();

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("proxies active runs for the signed-in user", async () => {
    fetchMock().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "run-1",
            agentId: "agent-1",
            status: "RUNNING",
            agent: { id: "agent-1", name: "Research" },
          },
        ]),
        { status: 200 },
      ),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(requestUrl(fetchMock().mock.calls[0][0] as string)).toBe(
      "http://agent-service.test/api/runs/active?userId=user-1",
    );
    expect(JSON.parse(res._getData() as string)).toEqual([
      {
        id: "run-1",
        agentId: "agent-1",
        status: "RUNNING",
        agent: { id: "agent-1", name: "Research" },
      },
    ]);
  });

  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
