/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/projects/[projectId]/terminal/session";

const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

const origFetch = globalThis.fetch;
const origSecret = process.env.NEXTAUTH_SECRET;

describe("API POST /api/projects/[projectId]/terminal/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-terminal-secret";
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.NEXTAUTH_SECRET = origSecret;
  });

  it("returns 409 when container is not running", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "env1", projectId: "p1", status: "STOPPED", port: 4000, containerId: "c1" },
        ]),
      ),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { projectId: "p1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res._getData() as string);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("not_active");
  });

  it("returns wsUrl and token when environment is running", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1" });
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "env1", projectId: "p1", status: "RUNNING", port: 4000, containerId: "c1" },
        ]),
      ),
    );

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { projectId: "p1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.ok).toBe(true);
    expect(body.wsUrl).toContain("/api/environments/env1/terminal/ws");
    expect(typeof body.token).toBe("string");
    expect(body.token.split(".")).toHaveLength(2);
  });
});
