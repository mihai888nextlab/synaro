import type { NextApiRequest, NextApiResponse } from "next";

import { getProjectRuntimeLogs } from "@/lib/mcp-deploy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "GET")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "missing_project_id" });

  const source = typeof req.query.source === "string" ? req.query.source : "runtime";
  const linesRaw = typeof req.query.lines === "string" ? Number(req.query.lines) : 150;
  const lines = Number.isFinite(linesRaw) ? linesRaw : 150;
  const taskId = typeof req.query.task_id === "string" ? req.query.task_id.trim() : "";

  try {
    if (source === "task") {
      if (!taskId) return res.status(400).json({ error: "task_id is required when source=task" });
      const upstream = await fetch(`${aiServiceBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}`);
      const data = (await upstream.json()) as {
        error?: string;
        progress?: string | null;
        streamContent?: string | null;
        errorMessage?: string | null;
        status?: string;
      };
      if (!upstream.ok) return res.status(upstream.status).json(data);
      return res.status(200).json({
        source: "task",
        task_id: taskId,
        status: data.status ?? null,
        lines: [
          data.progress ? `progress: ${data.progress}` : "",
          data.streamContent ?? "",
          data.errorMessage ? `error: ${data.errorMessage}` : "",
        ].filter(Boolean),
      });
    }

    const logLines = await getProjectRuntimeLogs(projectId, auth.userId, lines);
    return res.status(200).json({ source: "runtime", lines: logLines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 502;
    return res.status(status).json({ error: msg });
  }
}
