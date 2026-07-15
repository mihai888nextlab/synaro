/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import passwordHandler from "@/pages/api/account/password";
import sessionsHandler from "@/pages/api/account/sessions";
import {
  getServerSessionMock,
  mockSession,
} from "@/testing/security-route-helpers";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue("hashed"),
}));

import { prisma } from "@/lib/prisma";

const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe("API /api/account/password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession("user-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      body: {},
    });
    await passwordHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects short passwords", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      body: { newPassword: "short" },
    });
    await passwordHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("updates password for OAuth-only user", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ passwordHash: null } as never);
    prismaMock.user.update.mockResolvedValueOnce({} as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      body: { newPassword: "new-password-12" },
    });
    await passwordHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});

describe("API /api/account/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession("user-1");
  });

  it("GET returns session metadata", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ sessionVersion: 2 } as never);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await sessionsHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ sessionVersion: 2, canSignOutEverywhere: true });
  });

  it("POST increments session version", async () => {
    prismaMock.user.update.mockResolvedValueOnce({} as never);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      query: { everywhere: "1" },
    });
    await sessionsHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { sessionVersion: { increment: 1 } },
      }),
    );
  });
});
