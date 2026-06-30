import type { NextApiRequest, NextApiResponse } from "next";

import {
  createProjectTask,
  listProjectTasks,
} from "@/lib/public-api/project-tasks";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { toSnakeCaseJson } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "POST"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "missing_project_id" });

  try {
    if (req.method === "GET") {
      const data = await listProjectTasks(projectId, auth.userId);
      return res.status(200).json(toSnakeCaseJson(data));
    }

    const body = req.body as { prompt?: unknown; mode?: unknown };
    if (typeof body.prompt !== "string" || !body.prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const created = await createProjectTask(projectId, auth.userId, {
      prompt: body.prompt,
      mode: body.mode === "answer" ? "answer" : "generate",
    });

    return res.status(202).json({
      task_id: created.task_id,
      status: created.status,
      poll_url: `/api/v1/tasks/${created.task_id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 502;
    return res.status(status).json({ error: msg });
  }
}
