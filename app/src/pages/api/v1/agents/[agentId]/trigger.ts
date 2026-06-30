import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "POST")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "missing_agent_id" });

  try {
    const { status, body } = await proxyAgentService(`/api/agents/${agentId}/trigger`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    });
    return res.status(status).json(toSnakeCaseJson(body));
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
