import type { NextApiRequest, NextApiResponse } from "next";

import { getProjectTask } from "@/lib/public-api/project-tasks";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "GET")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const taskId = typeof req.query.taskId === "string" ? req.query.taskId : "";
  if (!taskId) return res.status(400).json({ error: "missing_task_id" });

  const wait = req.query.wait !== "false";
  const timeoutRaw =
    typeof req.query.timeout_seconds === "string" ? Number(req.query.timeout_seconds) : 300;

  try {
    const task = await getProjectTask(taskId, auth.userId, {
      wait,
      timeoutSeconds: Number.isFinite(timeoutRaw) ? timeoutRaw : 300,
    });
    return res.status(200).json(task);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 502;
    return res.status(status).json({ error: msg });
  }
}
