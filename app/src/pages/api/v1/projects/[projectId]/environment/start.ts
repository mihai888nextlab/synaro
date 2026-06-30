import type { NextApiRequest, NextApiResponse } from "next";

import { controlProjectEnvironment } from "@/lib/public-api/control-project-environment";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "POST")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "missing_project_id" });

  try {
    const result = await controlProjectEnvironment(projectId, auth.userId, "start");
    return res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return res.status(404).json({ error: msg });
    if (msg.includes("already starting")) return res.status(409).json({ error: msg });
    return res.status(502).json({ error: msg });
  }
}
