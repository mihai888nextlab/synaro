/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import handler from "@/pages/api/account/search-index";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;
const findManyMock = jest.mocked(prisma.project.findMany);

const origFetch = globalThis.fetch;
const origAgentKey = process.env.AGENT_SERVICE_KEY;
const origAgentUrl = process.env.AGENT_SERVICE_URL;

describe("API /api/account/search-index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENT_SERVICE_KEY = "test-agent-key";
    process.env.AGENT_SERVICE_URL = "http://agent-service.test";
    globalThis.fetch = jest.fn() as unknown as typeof fetch;

    findManyMock.mockResolvedValue([
      { id: "p1", slug: "demo", name: "Demo", description: "" },
    ]);
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify([{ id: "a1", name: "Research", description: "" }]), {
        status: 200,
      }),
    );
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
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns search index for authenticated user", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(findManyMock).toHaveBeenCalled();
    expect(JSON.parse(res._getData() as string)).toEqual({
      projects: [{ id: "p1", slug: "demo", name: "Demo", description: "" }],
      agents: [{ id: "a1", name: "Research", description: "" }],
    });
    expect(res.getHeader("Cache-Control")).toBe("private, max-age=60");
  });

  it("returns 405 for unsupported methods", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
