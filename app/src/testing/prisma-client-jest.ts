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
    count: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(0),
  };
  user = {
    findUnique: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
    updateMany: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({ count: 0 }),
  };
  account = {
    findFirst: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(null),
  };
  apiKey = {
    findFirst: jest.fn() as jest.MockedFunction<any>,
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
  // Billing models (safe defaults so routes that meter usage don't crash in tests).
  usageCounter = {
    findUnique: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(null),
    upsert: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({ count: 1 }),
    update: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({ count: 0 }),
  };
  subscription = {
    findUnique: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(null),
    upsert: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
  processedStripeEvent = {
    create: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
    delete: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  };
}
