import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
import { deployProjectForUser } from "@/lib/mcp-deploy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const body = req.body as { wait_until_ready?: unknown; timeout_seconds?: unknown };

  try {
    const result = await deployProjectForUser(projectId, userId, {
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
