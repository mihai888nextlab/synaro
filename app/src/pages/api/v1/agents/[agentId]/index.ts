import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "PATCH", "DELETE"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "missing_agent_id" });

  try {
    if (req.method === "GET") {
      const { status, body } = await proxyAgentService(`/api/agents/${agentId}`);
      return res.status(status).json(toSnakeCaseJson(body));
    }

    if (req.method === "PATCH") {
      const { status, body } = await proxyAgentService(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(req.body ?? {}),
      });
      return res.status(status).json(toSnakeCaseJson(body));
    }

    if (req.method === "DELETE") {
      const { status, body } = await proxyAgentService(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      if (status === 204) return res.status(204).end();
      return res.status(status).json(toSnakeCaseJson(body));
    }

    return res.status(405).json({ error: "method_not_allowed" });
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
