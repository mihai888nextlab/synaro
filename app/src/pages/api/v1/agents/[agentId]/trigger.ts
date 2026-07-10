import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import { reserveAgentRun, releaseAgentRun } from "@/lib/billing/usage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "POST")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "missing_agent_id" });

  const userId = auth.userId;

  // Trial gating.
  const { gated } = await getUserEntitlements(userId);
  if (gated) {
    return res.status(402).json({
      error: "limit_exceeded",
      metric: "trial_expired",
      limit: 0,
      upgrade_url: "/settings/billing",
    });
  }

  // Reserve one agent run against the monthly cap before proxying.
  const reservation = await reserveAgentRun(userId);
  if (!reservation.ok) {
    return res.status(402).json({
      error: "limit_exceeded",
      metric: "agent_runs",
      limit: reservation.limit,
      upgrade_url: "/settings/billing",
    });
  }

  try {
    const { status, body } = await proxyAgentService(`/api/agents/${agentId}/trigger`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    });
    // Don't bill a run the agent service rejected.
    if (status >= 400) await releaseAgentRun(userId);
    return res.status(status).json(toSnakeCaseJson(body));
  } catch {
    await releaseAgentRun(userId);
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
