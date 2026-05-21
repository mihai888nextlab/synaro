/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

/**
 * Substituted for `@prisma/client` in Jest (`moduleNameMapper`).
 * Next's SWC rewrites `@/lib/...` imports, so mocking `@/lib/prisma` is unreliable; this targets the stable package id.
 */
export class PrismaClient {
  project = {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
  account = {
    findFirst: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(null),
  };
}
