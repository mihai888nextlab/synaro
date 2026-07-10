import { prisma } from "@/lib/prisma";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import { assertCanCreateProject } from "@/lib/billing/guards";

jest.mock("@/lib/prisma", () => ({
  prisma: { project: { count: jest.fn() } },
}));

jest.mock("@/lib/billing/get-user-entitlements", () => ({
  getUserEntitlements: jest.fn(),
}));

const count = prisma.project.count as jest.Mock;
const entitlements = getUserEntitlements as jest.Mock;

function resolved(over: Partial<{ gated: boolean; maxProjects: number; maxConcurrentEnvironments: number }>) {
  return {
    gated: over.gated ?? false,
    tier: "STARTER",
    entitlements: {
      maxProjects: over.maxProjects ?? 5,
      maxConcurrentEnvironments: over.maxConcurrentEnvironments ?? 3,
    },
  };
}

describe("assertCanCreateProject", () => {
  beforeEach(() => {
    count.mockReset();
    entitlements.mockReset();
  });

  it("blocks a gated (expired-trial) user", async () => {
    entitlements.mockResolvedValue(resolved({ gated: true }));
    const r = await assertCanCreateProject("u1");
    expect(r).toEqual({ ok: false, metric: "trial_expired", limit: 0 });
    expect(count).not.toHaveBeenCalled();
  });

  it("blocks when the project cap is reached", async () => {
    entitlements.mockResolvedValue(resolved({ maxProjects: 5 }));
    // project count = 5 (at cap), running = 0
    count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    const r = await assertCanCreateProject("u1");
    expect(r).toEqual({ ok: false, metric: "projects", limit: 5 });
  });

  it("blocks when the concurrent-environment cap is reached", async () => {
    entitlements.mockResolvedValue(resolved({ maxProjects: 5, maxConcurrentEnvironments: 3 }));
    // projects under cap (2), running at cap (3)
    count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const r = await assertCanCreateProject("u1");
    expect(r).toEqual({ ok: false, metric: "concurrent_environments", limit: 3 });
  });

  it("allows when under both caps", async () => {
    entitlements.mockResolvedValue(resolved({ maxProjects: 5, maxConcurrentEnvironments: 3 }));
    count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const r = await assertCanCreateProject("u1");
    expect(r.ok).toBe(true);
  });
});
