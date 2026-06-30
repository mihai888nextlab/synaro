import type { NextApiRequest, NextApiResponse } from "next";

import { deployProjectForUser } from "@/lib/mcp-deploy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "POST")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "missing_project_id" });

  const body = req.body as { wait_until_ready?: unknown; timeout_seconds?: unknown };

  try {
    const result = await deployProjectForUser(projectId, auth.userId, {
      waitUntilReady: body.wait_until_ready !== false,
      timeoutSeconds:
        typeof body.timeout_seconds === "number" ? body.timeout_seconds : undefined,
    });
    return res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 502;
    return res.status(status).json({ error: msg });
  }
}
