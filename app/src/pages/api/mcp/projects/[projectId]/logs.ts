import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
import { getProjectRuntimeLogs } from "@/lib/mcp-deploy";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

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

    const logLines = await getProjectRuntimeLogs(projectId, userId, lines);
    return res.status(200).json({ source: "runtime", lines: logLines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 502;
    return res.status(status).json({ error: msg });
  }
}
