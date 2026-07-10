import type { NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import {
  getUserEntitlements,
  type ResolvedEntitlements,
} from "@/lib/billing/get-user-entitlements";
import { withinLimit } from "@/lib/billing/entitlements";

export const BILLING_UPGRADE_URL = "/settings/billing";

export type LimitMetric =
  | "agent_runs"
  | "projects"
  | "concurrent_environments"
  | "trial_expired";

/** Machine-readable 402 body consumed by the client 402 handler. */
export function respondLimitExceeded(
  res: NextApiResponse,
  opts: { metric: LimitMetric; limit: number; upgradeUrl?: string; detail?: string },
): void {
  res.status(402).json({
    error: "limit_exceeded",
    metric: opts.metric,
    limit: opts.limit,
    upgradeUrl: opts.upgradeUrl ?? BILLING_UPGRADE_URL,
    detail: opts.detail,
  });
}

export type ProjectGuardResult =
  | { ok: true; entitlements: ResolvedEntitlements }
  | { ok: false; metric: LimitMetric; limit: number };

/**
 * Check project + concurrent-environment caps (and trial gating) before creating
 * a project. Counts live in the frontend DB, so both checks are cheap.
 */
export async function assertCanCreateProject(userId: string): Promise<ProjectGuardResult> {
  const resolved = await getUserEntitlements(userId);
  if (resolved.gated) {
    return { ok: false, metric: "trial_expired", limit: 0 };
  }

  const { maxProjects, maxConcurrentEnvironments } = resolved.entitlements;

  const [projectCount, runningCount] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.project.count({ where: { userId, environmentStatus: "RUNNING" } }),
  ]);

  if (!withinLimit(projectCount, maxProjects)) {
    return { ok: false, metric: "projects", limit: maxProjects };
  }
  // Creating a project provisions a RUNNING environment, so it counts against
  // the concurrent-environment cap too.
  if (!withinLimit(runningCount, maxConcurrentEnvironments)) {
    return { ok: false, metric: "concurrent_environments", limit: maxConcurrentEnvironments };
  }

  return { ok: true, entitlements: resolved };
}
