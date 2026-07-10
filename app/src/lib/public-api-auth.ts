import type { NextApiRequest, NextApiResponse } from "next";

import { hashApiKey } from "@/lib/api-key-crypto";
import {
  applyRateLimitHeaders,
  applyRetryAfterHeader,
  checkPublicApiRateLimit,
  explicitConfiguredLimit,
} from "@/lib/public-api/rate-limit";
import { getEffectiveApiRateLimit } from "@/lib/billing/get-user-entitlements";
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

  const tierLimit = await getEffectiveApiRateLimit(auth.userId);
  const envCap = explicitConfiguredLimit();
  const effectiveLimit = envCap != null ? Math.min(envCap, tierLimit) : tierLimit;
  const rate = checkPublicApiRateLimit(auth.apiKeyId, Date.now(), effectiveLimit);
  if (!rate.allowed) {
    applyRateLimitHeaders(res, rate);
    applyRetryAfterHeader(res, rate);
    res.status(429).json({
      error: "rate_limit_exceeded",
      detail: `API rate limit exceeded. Retry after ${Math.max(1, Math.ceil((rate.reset_at - Date.now()) / 1000))} seconds.`,
      limit: rate.limit,
      reset_at: new Date(rate.reset_at).toISOString(),
    });
    return null;
  }

  applyRateLimitHeaders(res, rate);
  return auth;
}
