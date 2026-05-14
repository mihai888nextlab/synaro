/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/projects/[projectId]/workspace-selection";

const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

const origFetch = globalThis.fetch;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("API GET /api/projects/[projectId]/workspace-selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns 405 for non-GET methods (contract / security baseline)", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { projectId: "p1", path: "README.md" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._getHeaders().allow).toBe("GET");
  });

  it("returns 401 when session is missing (unauthenticated access)", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1", path: "src/index.ts" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData() as string).error).toBe("Unauthorized");
  });

  it("returns 400 when path query is missing (input validation)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1", path: "   " },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when project is not owned by the signed-in user (IDOR guard)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "foreign-project", path: "README.md" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "foreign-project",
          OR: expect.any(Array) as unknown,
        }),
      }),
    );
  });

  it("returns 409 and syncs STOPPED when no active runtime exists (stale UI vs reality)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1", cloneRepositoryUrl: null });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      expect(requestUrl(input)).toContain("/api/environments?");
      return new Response(JSON.stringify([]));
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1", path: "README.md" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(prisma.project.update).toHaveBeenCalled();
  });

  it("returns 200 with merged remote payload when environment is healthy (happy path)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({
      id: "p1",
      cloneRepositoryUrl: null,
    });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const u = requestUrl(input);
      if (u.includes("/api/environments?")) {
        return new Response(
          JSON.stringify([{ id: "e1", projectId: "p1", status: "RUNNING", port: 4001, containerId: "abc" }]),
        );
      }
      if (u.includes("/workspace-selection")) {
        return new Response(
          JSON.stringify({
            path: "README.md",
            kind: "file",
            content: "# Title",
            contentTruncated: false,
            gitLog: [{ shortSha: "deadbea", author: "Dev", date: "2024-01-01T00:00:00Z", subject: "init" }],
          }),
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1", path: "README.md" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.kind).toBe("file");
    expect(body.content).toBe("# Title");
    expect(globalThis.fetch).toHaveBeenCalled();
    const calls = (globalThis.fetch as jest.Mock).mock.calls as [RequestInfo | URL][];
    expect(calls.some((c) => requestUrl(c[0]).includes("/workspace-selection"))).toBe(true);
  });

  it("returns 500 when remoteWorkspaceSelection throws (container / network fault)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1", cloneRepositoryUrl: null });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const u = requestUrl(input);
      if (u.includes("/api/environments?")) {
        return new Response(JSON.stringify([{ id: "e1", projectId: "p1", status: "RUNNING", port: 1, containerId: "x" }]));
      }
      if (u.includes("/workspace-selection")) {
        return new Response("upstream failure", { status: 502 });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1", path: "README.md" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res._getData() as string).error).toMatch(/Failed to load/);
  });
});
