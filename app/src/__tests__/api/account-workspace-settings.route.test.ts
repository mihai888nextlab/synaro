/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/account/workspace-settings";
import {
  getServerSessionMock,
  mockSession,
} from "@/testing/security-route-helpers";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe("API /api/account/workspace-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession("user-1");
  });

  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET returns workspace settings", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      idleStopMinutes: 30,
      defaultAgentModel: null,
      defaultAgentMaxSteps: null,
      defaultAgentToolMode: null,
    } as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({
      idleStopMinutes: 30,
      defaultAgentModel: "kimi-k2.6",
      defaultAgentMaxSteps: 20,
      defaultAgentToolMode: "auto",
    });
  });

  it("PATCH updates idle stop minutes", async () => {
    prismaMock.user.update.mockResolvedValueOnce({
      idleStopMinutes: 60,
      defaultAgentModel: null,
      defaultAgentMaxSteps: null,
      defaultAgentToolMode: null,
    } as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "PATCH",
      body: { idleStopMinutes: 60 },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { idleStopMinutes: 60 },
      }),
    );
  });
});
