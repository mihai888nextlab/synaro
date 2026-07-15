/** @jest-environment node */

import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";

import type { RequestMethod, Body } from 'node-mocks-http'

export const SECURITY_USER_A = "security-user-a";
export const SECURITY_USER_B = "security-user-b";
export const SECURITY_PROJECT_A = "security-project-a";

export const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

export function mockSession(userId: string) {
  getServerSessionMock.mockResolvedValue({
    user: { id: userId, name: "Test", email: `${userId}@test.local` },
  } as never);
}

export function mockUnauthenticated() {
  getServerSessionMock.mockResolvedValue(null);
}

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void | unknown>;

export async function invokeRoute(
  handler: Handler,
  options: {
    method: string;
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: options.method as RequestMethod,
    query: options.query,
    body: options.body as Body,
    headers: options.headers,
  });
  await handler(req, res);
  return { req, res };
}

export async function expectUnauthorized(
  handler: Handler,
  options: {
    method: string;
    query?: Record<string, string>;
    body?: unknown;
  },
) {
  mockUnauthenticated();
  const { res } = await invokeRoute(handler, options);
  expect(res.statusCode).toBe(401);
  const raw = res._getData();
  if (typeof raw === "string" && raw.length > 0) {
    const body = JSON.parse(raw) as { error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  }
}

export async function expectProjectNotFound(
  handler: Handler,
  options: {
    method: string;
    query?: Record<string, string>;
    body?: unknown;
  },
) {
  mockSession(SECURITY_USER_B);
  jest.mocked(prisma.project.findFirst).mockResolvedValue(null);

  const { res } = await invokeRoute(handler, options);
  expect(res.statusCode).toBe(404);
  expect(jest.mocked(prisma.project.findFirst)).toHaveBeenCalled();
}
