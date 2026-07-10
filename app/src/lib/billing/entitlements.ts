import type { PlanTier } from "@prisma/client";

/**
 * Per-tier usage limits and container compute. Single source of truth for all
 * enforcement. `-1` means "unlimited". Numbers are a starting proposal — tune
 * before launch.
 */
export type Entitlements = {
  /** Agent runs allowed per calendar month (UTC). -1 = unlimited. */
  maxAgentRunsPerMonth: number;
  /** Total projects a user may own. -1 = unlimited. */
  maxProjects: number;
  /** Projects with a RUNNING environment at once. -1 = unlimited. */
  maxConcurrentEnvironments: number;
  /** Docker container memory in MB -> hostConfig.Memory. */
  containerMemoryMb: number;
  /** Docker container CPU in nano-CPUs -> hostConfig.NanoCpus (1e9 = 1 CPU). */
  containerNanoCpus: number;
  /** Public API (`/api/v1`) requests per minute for this tier. */
  apiRateLimitPerMin: number;
};

export const PLAN_ENTITLEMENTS: Record<PlanTier, Entitlements> = {
  FREE: {
    maxAgentRunsPerMonth: 25,
    maxProjects: 1,
    maxConcurrentEnvironments: 1,
    containerMemoryMb: 512,
    containerNanoCpus: 250_000_000, // 0.25 CPU
    apiRateLimitPerMin: 30,
  },
  STARTER: {
    maxAgentRunsPerMonth: 2_000,
    maxProjects: 5,
    maxConcurrentEnvironments: 3,
    containerMemoryMb: 1024,
    containerNanoCpus: 500_000_000, // 0.5 CPU
    apiRateLimitPerMin: 120,
  },
  PRO: {
    maxAgentRunsPerMonth: 20_000,
    maxProjects: 25,
    maxConcurrentEnvironments: 20,
    containerMemoryMb: 4096,
    containerNanoCpus: 2_000_000_000, // 2 CPU
    apiRateLimitPerMin: 600,
  },
  ENTERPRISE: {
    maxAgentRunsPerMonth: -1,
    maxProjects: -1,
    maxConcurrentEnvironments: -1,
    containerMemoryMb: 8192,
    containerNanoCpus: 4_000_000_000, // 4 CPU
    apiRateLimitPerMin: 2000,
  },
};

/** Length of the free trial granted to new accounts. */
export const TRIAL_DAYS = 14;

/** A `Date` `TRIAL_DAYS` from `from` — the trial expiry to store on a new user. */
export function trialEndDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export const isUnlimited = (n: number): boolean => n < 0;

/** True when `used` is still under `limit` (or the limit is unlimited). */
export const withinLimit = (used: number, limit: number): boolean =>
  isUnlimited(limit) || used < limit;

export function entitlementsForTier(tier: PlanTier): Entitlements {
  return PLAN_ENTITLEMENTS[tier];
}
