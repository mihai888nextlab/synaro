import type { NextApiRequest, NextApiResponse } from "next";

import { proxyAgentService } from "@/lib/public-api/agent-proxy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "GET")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const runId = typeof req.query.runId === "string" ? req.query.runId : "";
  if (!runId) return res.status(400).json({ error: "missing_run_id" });

  try {
    const { status, body } = await proxyAgentService(`/api/runs/${runId}`);
    return res.status(status).json(toSnakeCaseJson(body));
  } catch {
    return res.status(502).json({ error: "agent_service_unavailable" });
  }
}
