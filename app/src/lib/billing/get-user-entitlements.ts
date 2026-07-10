import type { PlanTier, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  entitlementsForTier,
  type Entitlements,
} from "@/lib/billing/entitlements";

export type ResolvedEntitlements = {
  tier: PlanTier;
  entitlements: Entitlements;
  trialActive: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: SubscriptionStatus | null;
  /** FREE trial expired and no active paid sub => block gated actions. */
  gated: boolean;
};

/**
 * Subscription statuses that grant the user their paid tier. PAST_DUE keeps
 * access during Stripe's dunning grace period; it flips to UNPAID/CANCELED via
 * webhook when Stripe finally gives up.
 */
const ACTIVE_SUB_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
]);

type CacheEntry = { value: ResolvedEntitlements; expires: number };
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/** Drop a user's cached entitlements. Called by webhooks after a subscription write. */
export function invalidateEntitlements(userId: string): void {
  cache.delete(userId);
}

/** Test/util helper — clear the whole cache. */
export function clearEntitlementsCache(): void {
  cache.clear();
}

async function resolve(userId: string, now: Date): Promise<ResolvedEntitlements> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      trialEndsAt: true,
      subscription: {
        select: { tier: true, status: true },
      },
    },
  });

  const sub = user?.subscription ?? null;
  if (sub && ACTIVE_SUB_STATUSES.has(sub.status)) {
    return {
      tier: sub.tier,
      entitlements: entitlementsForTier(sub.tier),
      trialActive: false,
      trialEndsAt: user?.trialEndsAt ?? null,
      subscriptionStatus: sub.status,
      gated: false,
    };
  }

  const trialEndsAt = user?.trialEndsAt ?? null;
  const trialActive = trialEndsAt !== null && trialEndsAt.getTime() > now.getTime();

  return {
    tier: "FREE",
    entitlements: entitlementsForTier("FREE"),
    trialActive,
    trialEndsAt,
    subscriptionStatus: sub?.status ?? null,
    gated: !trialActive, // FREE + no active trial => gated
  };
}

/**
 * Resolve a user's effective tier + limits. Reads the DB (source of truth) with
 * a short in-process cache so hot-path requests avoid a round-trip. Never reads
 * from the JWT — a stateless JWT can't reflect webhook-driven plan changes.
 */
export async function getUserEntitlements(userId: string): Promise<ResolvedEntitlements> {
  const now = new Date();
  // Bypass the process-wide cache under test so its TTL can't leak across cases.
  if (process.env.NODE_ENV === "test") return resolve(userId, now);
  const cached = cache.get(userId);
  if (cached && cached.expires > now.getTime()) {
    // A cached "trial active" can lapse mid-TTL; recompute the trial flag cheaply.
    if (!cached.value.subscriptionStatus || cached.value.tier === "FREE") {
      const trialEndsAt = cached.value.trialEndsAt;
      const trialActive = trialEndsAt !== null && trialEndsAt.getTime() > now.getTime();
      if (trialActive !== cached.value.trialActive) {
        const refreshed: ResolvedEntitlements = {
          ...cached.value,
          trialActive,
          gated: cached.value.tier === "FREE" && !trialActive,
        };
        cache.set(userId, { value: refreshed, expires: cached.expires });
        return refreshed;
      }
    }
    return cached.value;
  }

  const value = await resolve(userId, now);
  cache.set(userId, { value, expires: now.getTime() + CACHE_TTL_MS });
  return value;
}

/** Per-tier public API rate limit (requests/min) for the current user. */
export async function getEffectiveApiRateLimit(userId: string): Promise<number> {
  const { entitlements } = await getUserEntitlements(userId);
  return entitlements.apiRateLimitPerMin;
}
