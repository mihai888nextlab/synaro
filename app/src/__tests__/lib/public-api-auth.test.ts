import type { NextApiRequest } from "next";

import { generateApiKey, hashApiKey } from "@/lib/api-key-crypto";
import { resolvePublicApiAuth } from "@/lib/public-api-auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

function mockReq(auth?: string): NextApiRequest {
  return {
    headers: auth ? { authorization: auth } : {},
  } as NextApiRequest;
}

describe("public-api-auth", () => {
  const findFirst = prisma.apiKey.findFirst as jest.Mock;

  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns user id for valid bearer token", async () => {
    const { raw } = generateApiKey();
    findFirst.mockResolvedValue({ id: "key-1", userId: "user-123" });

    const auth = await resolvePublicApiAuth(mockReq(`Bearer ${raw}`));
    expect(auth).toEqual({ userId: "user-123", apiKeyId: "key-1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey(raw), revokedAt: null },
      select: { id: true, userId: true },
    });
  });

  it("rejects missing or wrong token", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolvePublicApiAuth(mockReq())).toBeNull();
    expect(await resolvePublicApiAuth(mockReq("Bearer wrong"))).toBeNull();
  });
});
