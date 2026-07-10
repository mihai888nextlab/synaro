/** @jest-environment node */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("@/lib/public-api-auth", () => ({
  requirePublicApiAuth: jest.fn(),
  resolvePublicApiAuth: jest.fn(),
}));

jest.mock("@/lib/public-api/agent-proxy", () => ({
  proxyAgentService: jest.fn(),
}));

// Billing enforcement is exercised in the billing unit tests; here it is transparent.
jest.mock("@/lib/billing/get-user-entitlements", () => ({
  getUserEntitlements: jest.fn().mockResolvedValue({ gated: false }),
}));
jest.mock("@/lib/billing/usage", () => ({
  reserveAgentRun: jest.fn().mockResolvedValue({ ok: true }),
  releaseAgentRun: jest.fn().mockResolvedValue(undefined),
}));

import agentsIndexHandler from "@/pages/api/v1/agents/index";
import agentByIdHandler from "@/pages/api/v1/agents/[agentId]/index";
import agentTriggerHandler from "@/pages/api/v1/agents/[agentId]/trigger";
import agentRunsHandler from "@/pages/api/v1/agents/[agentId]/runs";
import runByIdHandler from "@/pages/api/v1/runs/[runId]";
import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";

const requirePublicApiAuthMock = requirePublicApiAuth as jest.MockedFunction<
  typeof requirePublicApiAuth
>;
const proxyAgentServiceMock = proxyAgentService as jest.MockedFunction<typeof proxyAgentService>;

const mockPublicApiAuth = {
  userId: "user-1",
  apiKeyId: "key-1",
};

describe("Public API /api/v1/agents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePublicApiAuthMock.mockResolvedValue(mockPublicApiAuth);
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: [],
    });
  });

  it("GET /v1/agents proxies with authenticated userId", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: [{ id: "a1", createdAt: "2026-01-01T00:00:00.000Z" }],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await agentsIndexHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith(
      `/api/agents?userId=${encodeURIComponent(mockPublicApiAuth.userId)}`,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData() as string)).toEqual([
      { id: "a1", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("POST /v1/agents merges userId into upstream body", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 201,
      body: { id: "a1", name: "Research" },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { name: "Research" },
    });
    await agentsIndexHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: "Research", userId: mockPublicApiAuth.userId }),
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 405 for unsupported methods on /v1/agents", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "DELETE" });
    await agentsIndexHandler(req, res);
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res._getData() as string).error).toBe("method_not_allowed");
  });

  it("GET /v1/agents/:id returns snake_case payload", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: { id: "agent-1", runCount: 2 },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await agentByIdHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1");
    expect(JSON.parse(res._getData() as string)).toEqual({ id: "agent-1", run_count: 2 });
  });

  it("DELETE /v1/agents/:id returns 204 without body", async () => {
    proxyAgentServiceMock.mockResolvedValue({ status: 204, body: null });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1" },
    });
    await agentByIdHandler(req, res);

    expect(res.statusCode).toBe(204);
  });

  it("returns 400 when agentId is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET", query: {} });
    await agentByIdHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toBe("missing_agent_id");
  });

  it("POST /v1/agents/:id/trigger proxies trigger body", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 202,
      body: { runId: "run-1" },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { agentId: "agent-1" },
      body: { input: "hello" },
    });
    await agentTriggerHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1/trigger", {
      method: "POST",
      body: JSON.stringify({ input: "hello" }),
    });
    expect(JSON.parse(res._getData() as string)).toEqual({ run_id: "run-1" });
  });

  it("GET /v1/agents/:id/runs proxies runs list", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: [{ id: "run-1", agentId: "agent-1" }],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await agentRunsHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1/runs");
    expect(JSON.parse(res._getData() as string)).toEqual([{ id: "run-1", agent_id: "agent-1" }]);
  });

  it("GET /v1/runs/:runId proxies run detail", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: { id: "run-1", startedAt: "2026-01-01T00:00:00.000Z" },
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { runId: "run-1" },
    });
    await runByIdHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/runs/run-1");
    expect(JSON.parse(res._getData() as string)).toEqual({
      id: "run-1",
      started_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns 400 when runId is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET", query: {} });
    await runByIdHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toBe("missing_run_id");
  });

  it("returns 502 when agent service proxy throws", async () => {
    proxyAgentServiceMock.mockRejectedValue(new Error("down"));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await agentsIndexHandler(req, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res._getData() as string).error).toBe("agent_service_unavailable");
  });

  it("stops when public API auth fails", async () => {
    requirePublicApiAuthMock.mockResolvedValue(null);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await agentsIndexHandler(req, res);

    expect(proxyAgentServiceMock).not.toHaveBeenCalled();
  });
});
