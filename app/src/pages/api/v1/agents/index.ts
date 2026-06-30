import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "POST"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const { status, body } = await proxyAgentService(
        `/api/agents?userId=${encodeURIComponent(auth.userId)}`,
      );
      return res.status(status).json(toSnakeCaseJson(body));
    }

    const { status, body } = await proxyAgentService("/api/agents", {
      method: "POST",
      body: JSON.stringify({ ...(req.body as Record<string, unknown>), userId: auth.userId }),
    });
    return res.status(status).json(toSnakeCaseJson(body));
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
