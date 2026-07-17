/** @jest-environment node */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

jest.mock("@/lib/public-api-auth", () => ({
  requirePublicApiAuth: jest.fn(),
}));

jest.mock("@/lib/public-api/agent-proxy", () => ({
  proxyAgentService: jest.fn(),
}));

import cancelHandler from "@/pages/api/v1/runs/[runId]/cancel";
import credentialsHandler from "@/pages/api/v1/runs/[runId]/credentials";
import activeRunsHandler from "@/pages/api/v1/runs/active";
import recentRunsHandler from "@/pages/api/v1/runs/recent";
import memoryIndexHandler from "@/pages/api/v1/agents/[agentId]/memory/index";
import memoryKeyHandler from "@/pages/api/v1/agents/[agentId]/memory/[key]";
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

describe("Public API Phase 2 — runs cancel/credentials/active/recent + memory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requirePublicApiAuthMock.mockResolvedValue(mockPublicApiAuth);
    proxyAgentServiceMock.mockResolvedValue({ status: 200, body: { ok: true } });
  });

  it("POST /v1/runs/:id/cancel proxies with userId", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { runId: "run-1" },
    });
    await cancelHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/runs/run-1/cancel", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /v1/runs/:id/credentials accepts mcp_auth snake_case", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { runId: "run-1" },
      body: { mcp_auth: { github: { Authorization: "Bearer x" } } },
    });
    await credentialsHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/runs/run-1/credentials", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-1",
        mcpAuth: { github: { Authorization: "Bearer x" } },
      }),
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /v1/runs/active proxies for authenticated user", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await activeRunsHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/runs/active?userId=user-1");
    expect(res.statusCode).toBe(200);
  });

  it("GET /v1/runs/recent forwards limit", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { limit: "10" },
    });
    await recentRunsHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/runs/recent?userId=user-1&limit=10");
    expect(res.statusCode).toBe(200);
  });

  it("GET /v1/agents/:id/memory lists entries", async () => {
    proxyAgentServiceMock.mockResolvedValue({
      status: 200,
      body: [{ key: "k", content: "v" }],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { agentId: "agent-1" },
    });
    await memoryIndexHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1/memory?userId=user-1");
    expect(res.statusCode).toBe(200);
  });

  it("PUT /v1/agents/:id/memory/:key upserts", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PUT",
      query: { agentId: "agent-1", key: "theme" },
      body: { content: "dark" },
    });
    await memoryKeyHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1/memory/theme", {
      method: "PUT",
      body: JSON.stringify({ userId: "user-1", content: "dark" }),
    });
    expect(res.statusCode).toBe(200);
  });

  it("DELETE /v1/agents/:id/memory clears all", async () => {
    proxyAgentServiceMock.mockResolvedValue({ status: 204, body: null });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { agentId: "agent-1" },
    });
    await memoryIndexHandler(req, res);

    expect(proxyAgentServiceMock).toHaveBeenCalledWith("/api/agents/agent-1/memory", {
      method: "DELETE",
      body: JSON.stringify({ userId: "user-1" }),
    });
    expect(res.statusCode).toBe(204);
  });
});
