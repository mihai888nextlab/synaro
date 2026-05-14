/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import handler from "@/pages/api/projects/[projectId]/workspace-files";

const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

const origFetch = globalThis.fetch;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("API GET /api/projects/[projectId]/workspace-files", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns no_environment reason when project has zero environments (fresh project)", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1" });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      expect(requestUrl(input)).toContain("/api/environments?");
      return new Response(JSON.stringify([]));
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res._getData() as string);
    expect(body.reason).toBe("no_environment");
    expect(body.paths).toEqual([]);
  });

  it("returns not_active and syncs DB when runtime row exists but none are RUNNING/PROVISIONING", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1" });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      expect(requestUrl(input)).toContain("/api/environments?");
      return new Response(
        JSON.stringify([{ id: "e1", projectId: "p1", status: "STOPPED", port: null, containerId: null }]),
      );
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData() as string).reason).toBe("not_active");
    expect(prisma.project.update).toHaveBeenCalled();
  });

  it("propagates clone_pending from remote without mutating project status", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", name: "t", email: "t@t.com" } } as never);
    prisma.project.findFirst.mockResolvedValue({ id: "p1" });
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const u = requestUrl(input);
      if (u.includes("/api/environments?")) {
        return new Response(
          JSON.stringify([{ id: "e1", projectId: "p1", status: "RUNNING", port: 4001, containerId: "c1" }]),
        );
      }
      if (u.includes("/workspace-files")) {
        return new Response(
          JSON.stringify({
            paths: [],
            truncated: false,
            rootLabel: "repo",
            clonePending: true,
          }),
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { projectId: "p1" },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res._getData() as string).reason).toBe("clone_pending");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
