/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

/**
 * Substituted for `@prisma/client` in Jest (`moduleNameMapper`).
 * Next's SWC rewrites `@/lib/...` imports, so mocking `@/lib/prisma` is unreliable; this targets the stable package id.
 */
export class PrismaClient {
  project = {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    findMany: jest.fn() as jest.MockedFunction<any>,
    findUnique: jest.fn() as jest.MockedFunction<any>,
    create: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
    delete: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
    findUniqueOrThrow: jest.fn() as jest.MockedFunction<any>,
  };
  user = {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
  account = {
    findFirst: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(null),
  };
  apiKey = {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
}
