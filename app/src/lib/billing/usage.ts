import { prisma } from "@/lib/prisma";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import { isUnlimited } from "@/lib/billing/entitlements";

export const AGENT_RUNS_METRIC = "agent_runs";

/** Current usage period key, "YYYY-MM" in UTC. A new month is a new counter row. */
export function utcPeriodKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Read the current-period value of a metric (0 if no row yet). */
export async function getUsage(
  userId: string,
  metric: string,
  now: Date = new Date(),
): Promise<number> {
  const row = await prisma.usageCounter.findUnique({
    where: { userId_period_metric: { userId, period: utcPeriodKey(now), metric } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export type ReserveResult =
  | { ok: true }
  | { ok: false; metric: string; limit: number };

/**
 * Atomically reserve one agent run against the monthly cap.
 *
 * Increments first (single upsert => no check-then-increment race), then rolls
 * back and reports failure if that increment crossed the limit. This yields a
 * strict hard cap with zero overshoot under concurrency. ENTERPRISE (unlimited)
 * short-circuits without touching the counter.
 *
 * On a successful proxy failure downstream, call `releaseAgentRun` to refund.
 */
export async function reserveAgentRun(
  userId: string,
  now: Date = new Date(),
): Promise<ReserveResult> {
  const { entitlements } = await getUserEntitlements(userId);
  const limit = entitlements.maxAgentRunsPerMonth;
  if (isUnlimited(limit)) return { ok: true };

  const period = utcPeriodKey(now);
  const row = await prisma.usageCounter.upsert({
    where: { userId_period_metric: { userId, period, metric: AGENT_RUNS_METRIC } },
    create: { userId, period, metric: AGENT_RUNS_METRIC, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  // row.count is the value AFTER our increment; the run we just reserved is the
  // (row.count)-th. Allowed only if the prior usage was still under the limit.
  if (row.count - 1 >= limit) {
    await releaseAgentRun(userId, now);
    return { ok: false, metric: AGENT_RUNS_METRIC, limit };
  }
  return { ok: true };
}

/** Refund one reserved agent run (floored at 0). Safe to call on any failure path. */
export async function releaseAgentRun(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const period = utcPeriodKey(now);
  try {
    const row = await prisma.usageCounter.findUnique({
      where: { userId_period_metric: { userId, period, metric: AGENT_RUNS_METRIC } },
      select: { count: true },
    });
    if (!row || row.count <= 0) return;
    await prisma.usageCounter.update({
      where: { userId_period_metric: { userId, period, metric: AGENT_RUNS_METRIC } },
      data: { count: { decrement: 1 } },
    });
  } catch {
    // Best-effort refund; never throw from a rollback path.
  }
}
