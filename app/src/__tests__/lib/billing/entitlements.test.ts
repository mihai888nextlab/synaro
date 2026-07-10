import {
  PLAN_ENTITLEMENTS,
  TRIAL_DAYS,
  entitlementsForTier,
  isUnlimited,
  trialEndDate,
  withinLimit,
} from "@/lib/billing/entitlements";

describe("billing entitlements catalog", () => {
  it("defines all four tiers", () => {
    expect(Object.keys(PLAN_ENTITLEMENTS).sort()).toEqual([
      "ENTERPRISE",
      "FREE",
      "PRO",
      "STARTER",
    ]);
  });

  it("keeps FREE small and monotonic up to PRO", () => {
    expect(PLAN_ENTITLEMENTS.FREE.maxAgentRunsPerMonth).toBeLessThan(
      PLAN_ENTITLEMENTS.STARTER.maxAgentRunsPerMonth,
    );
    expect(PLAN_ENTITLEMENTS.STARTER.maxProjects).toBeLessThan(PLAN_ENTITLEMENTS.PRO.maxProjects);
    expect(PLAN_ENTITLEMENTS.FREE.containerMemoryMb).toBeLessThan(
      PLAN_ENTITLEMENTS.PRO.containerMemoryMb,
    );
  });

  it("marks ENTERPRISE limits as unlimited", () => {
    const e = entitlementsForTier("ENTERPRISE");
    expect(isUnlimited(e.maxAgentRunsPerMonth)).toBe(true);
    expect(isUnlimited(e.maxProjects)).toBe(true);
    expect(isUnlimited(e.maxConcurrentEnvironments)).toBe(true);
  });

  it("withinLimit respects unlimited and boundaries", () => {
    expect(withinLimit(0, 1)).toBe(true);
    expect(withinLimit(1, 1)).toBe(false); // at the cap, one more is not allowed
    expect(withinLimit(999, -1)).toBe(true); // unlimited
  });

  it("trialEndDate is TRIAL_DAYS in the future", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const end = trialEndDate(from);
    const days = (end.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(TRIAL_DAYS);
  });
});
