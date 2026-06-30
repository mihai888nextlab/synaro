import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
import { getSynaroSystemStatus } from "@/lib/mcp-system-status";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const projectId =
    typeof req.query.project_id === "string" ? req.query.project_id.trim() : undefined;

  try {
    const status = await getSynaroSystemStatus({
      projectId: projectId || undefined,
      userId: projectId ? userId : undefined,
    });
    return res.status(200).json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "Failed to read system status", detail: msg });
  }
}
