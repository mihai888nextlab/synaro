import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "POST")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const runId = typeof req.query.runId === "string" ? req.query.runId : "";
  if (!runId) return res.status(400).json({ error: "missing_run_id" });

  const body = req.body as { mcp_auth?: unknown; mcpAuth?: unknown };
  const mcpAuth = body.mcpAuth ?? body.mcp_auth;
  if (!mcpAuth || typeof mcpAuth !== "object") {
    return res.status(400).json({ error: "mcp_auth_required" });
  }

  try {
    const { status, body: upstream } = await proxyAgentService(
      `/api/runs/${encodeURIComponent(runId)}/credentials`,
      {
        method: "POST",
        body: JSON.stringify({ userId: auth.userId, mcpAuth }),
      },
    );
    return res.status(status).json(toSnakeCaseJson(upstream));
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
