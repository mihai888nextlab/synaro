import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["PUT", "DELETE"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  const rawKey = typeof req.query.key === "string" ? req.query.key : "";
  if (!agentId) return res.status(400).json({ error: "missing_agent_id" });
  if (!rawKey) return res.status(400).json({ error: "missing_key" });

  const encodedKey = encodeURIComponent(rawKey);

  try {
    if (req.method === "PUT") {
      const content = typeof req.body?.content === "string" ? req.body.content : "";
      const { status, body } = await proxyAgentService(
        `/api/agents/${encodeURIComponent(agentId)}/memory/${encodedKey}`,
        {
          method: "PUT",
          body: JSON.stringify({ userId: auth.userId, content }),
        },
      );
      return res.status(status).json(toSnakeCaseJson(body));
    }

    const { status, body } = await proxyAgentService(
      `/api/agents/${encodeURIComponent(agentId)}/memory/${encodedKey}`,
      {
        method: "DELETE",
        body: JSON.stringify({ userId: auth.userId }),
      },
    );
    if (status === 204) return res.status(204).end();
    return res.status(status).json(toSnakeCaseJson(body));
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
