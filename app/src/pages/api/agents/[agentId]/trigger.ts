import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/next-auth-options";
import { getUserEntitlements } from "@/lib/billing/get-user-entitlements";
import { reserveAgentRun, releaseAgentRun } from "@/lib/billing/usage";
import { respondLimitExceeded } from "@/lib/billing/guards";

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}
function agentHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "Missing agentId" });

  const userId = session.user.id;

  // Trial gating.
  const { gated } = await getUserEntitlements(userId);
  if (gated) {
    return respondLimitExceeded(res, { metric: "trial_expired", limit: 0 });
  }

  // Reserve one agent run against the monthly cap before proxying.
  const reservation = await reserveAgentRun(userId);
  if (!reservation.ok) {
    return respondLimitExceeded(res, { metric: "agent_runs", limit: reservation.limit });
  }

  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/agents/${agentId}/trigger`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify(req.body ?? {}),
    });
    // Don't bill a run the agent service rejected.
    if (upstream.status >= 400) await releaseAgentRun(userId);
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    await releaseAgentRun(userId);
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
