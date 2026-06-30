import type { NextApiRequest, NextApiResponse } from "next";

import { hashApiKey } from "@/lib/api-key-crypto";
import { prisma } from "@/lib/prisma";

export type PublicApiAuth = {
  userId: string;
  apiKeyId: string;
};

export async function resolvePublicApiAuth(req: NextApiRequest): Promise<PublicApiAuth | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const keyHash = hashApiKey(token);
  const row = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    select: { id: true, userId: true },
  });
  if (!row) return null;

  void prisma.apiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return { userId: row.userId, apiKeyId: row.id };
}

export async function requirePublicApiAuth(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<PublicApiAuth | null> {
  const auth = await resolvePublicApiAuth(req);
  if (!auth) {
    res.status(401).json({
      error: "unauthorized",
      detail: "Provide Authorization: Bearer <api_key>. Create keys in Settings → API keys.",
    });
    return null;
  }
  return auth;
}
