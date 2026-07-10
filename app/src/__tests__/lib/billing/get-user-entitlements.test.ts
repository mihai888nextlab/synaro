import { prisma } from "@/lib/prisma";
import {
  clearEntitlementsCache,
  getUserEntitlements,
} from "@/lib/billing/get-user-entitlements";

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

const findUnique = prisma.user.findUnique as jest.Mock;

const HOUR = 60 * 60 * 1000;

describe("getUserEntitlements resolution", () => {
  beforeEach(() => {
    findUnique.mockReset();
    clearEntitlementsCache();
  });

  it("uses the paid tier for an ACTIVE subscription", async () => {
    findUnique.mockResolvedValue({
      trialEndsAt: null,
      subscription: { tier: "PRO", status: "ACTIVE" },
    });
    const r = await getUserEntitlements("u1");
    expect(r.tier).toBe("PRO");
    expect(r.gated).toBe(false);
    expect(r.entitlements.maxProjects).toBe(25);
  });

  it("keeps access while PAST_DUE (dunning grace)", async () => {
    findUnique.mockResolvedValue({
      trialEndsAt: null,
      subscription: { tier: "STARTER", status: "PAST_DUE" },
    });
    const r = await getUserEntitlements("u2");
    expect(r.tier).toBe("STARTER");
    expect(r.gated).toBe(false);
  });

  it("falls back to FREE (gated) for a CANCELED subscription and no trial", async () => {
    findUnique.mockResolvedValue({
      trialEndsAt: null,
      subscription: { tier: "PRO", status: "CANCELED" },
    });
    const r = await getUserEntitlements("u3");
    expect(r.tier).toBe("FREE");
    expect(r.gated).toBe(true);
  });

  it("is FREE and NOT gated while a trial is active", async () => {
    findUnique.mockResolvedValue({
      trialEndsAt: new Date(Date.now() + 24 * HOUR),
      subscription: null,
    });
    const r = await getUserEntitlements("u4");
    expect(r.tier).toBe("FREE");
    expect(r.trialActive).toBe(true);
    expect(r.gated).toBe(false);
  });

  it("is gated once the trial has expired with no paid sub", async () => {
    findUnique.mockResolvedValue({
      trialEndsAt: new Date(Date.now() - 24 * HOUR),
      subscription: null,
    });
    const r = await getUserEntitlements("u5");
    expect(r.tier).toBe("FREE");
    expect(r.trialActive).toBe(false);
    expect(r.gated).toBe(true);
  });

  it("treats an unknown user as gated FREE", async () => {
    findUnique.mockResolvedValue(null);
    const r = await getUserEntitlements("missing");
    expect(r.tier).toBe("FREE");
    expect(r.gated).toBe(true);
  });
});
