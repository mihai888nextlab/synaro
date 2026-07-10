import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import { AGENT_RUNS_METRIC, getUsage } from "@/lib/billing/usage";
import { isStripeConfigured } from "@/lib/billing/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const userId = session.user.id;

  const [resolved, subscription, agentRunsUsed, projectCount, runningCount] = await Promise.all([
    getUserEntitlements(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { cancelAtPeriodEnd: true, currentPeriodEnd: true, status: true },
    }),
    getUsage(userId, AGENT_RUNS_METRIC),
    prisma.project.count({ where: { userId } }),
    prisma.project.count({ where: { userId, environmentStatus: "RUNNING" } }),
  ]);

  const e = resolved.entitlements;
  return res.status(200).json({
    tier: resolved.tier,
    trialActive: resolved.trialActive,
    trialEndsAt: resolved.trialEndsAt,
    gated: resolved.gated,
    subscriptionStatus: resolved.subscriptionStatus,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    billingConfigured: isStripeConfigured(),
    entitlements: e,
    usage: {
      agentRuns: { used: agentRunsUsed, limit: e.maxAgentRunsPerMonth },
      projects: { used: projectCount, limit: e.maxProjects },
      concurrentEnvironments: { used: runningCount, limit: e.maxConcurrentEnvironments },
    },
  });
}
