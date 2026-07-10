import { prisma } from "@/lib/prisma";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import {
  AGENT_RUNS_METRIC,
  releaseAgentRun,
  reserveAgentRun,
  utcPeriodKey,
} from "@/lib/billing/usage";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    usageCounter: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/billing/get-user-entitlements", () => ({
  getUserEntitlements: jest.fn(),
}));

const upsert = prisma.usageCounter.upsert as jest.Mock;
const findUnique = prisma.usageCounter.findUnique as jest.Mock;
const update = prisma.usageCounter.update as jest.Mock;
const entitlements = getUserEntitlements as jest.Mock;

function withLimit(maxAgentRunsPerMonth: number) {
  entitlements.mockResolvedValue({ entitlements: { maxAgentRunsPerMonth } });
}

describe("reserveAgentRun / releaseAgentRun", () => {
  beforeEach(() => {
    upsert.mockReset();
    findUnique.mockReset();
    update.mockReset().mockResolvedValue({});
  });

  it("computes a YYYY-MM UTC period key", () => {
    expect(utcPeriodKey(new Date("2026-07-10T23:00:00.000Z"))).toBe("2026-07");
    expect(utcPeriodKey(new Date("2026-12-31T23:59:59.000Z"))).toBe("2026-12");
  });

  it("allows a run under the cap", async () => {
    withLimit(25);
    upsert.mockResolvedValue({ count: 1 }); // first run this month
    const r = await reserveAgentRun("u1");
    expect(r).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("blocks and rolls back the run that would exceed the cap", async () => {
    withLimit(25);
    upsert.mockResolvedValue({ count: 26 }); // increment pushed us past 25
    findUnique.mockResolvedValue({ count: 26 });
    const r = await reserveAgentRun("u1");
    expect(r).toEqual({ ok: false, metric: AGENT_RUNS_METRIC, limit: 25 });
    // rolled back
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { count: { decrement: 1 } } }),
    );
  });

  it("short-circuits unlimited tiers without touching the counter", async () => {
    withLimit(-1);
    const r = await reserveAgentRun("ent-user");
    expect(r).toEqual({ ok: true });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("release decrements a positive counter", async () => {
    findUnique.mockResolvedValue({ count: 3 });
    await releaseAgentRun("u1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { count: { decrement: 1 } } }),
    );
  });

  it("release is a no-op at zero", async () => {
    findUnique.mockResolvedValue({ count: 0 });
    await releaseAgentRun("u1");
    expect(update).not.toHaveBeenCalled();
  });
});
