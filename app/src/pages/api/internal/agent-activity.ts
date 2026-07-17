import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { recordAgentActivityLog, type AgentActivityKind } from "@/lib/activity-log";

const PayloadSchema = z.object({
  userId: z.string().min(1),
  agentName: z.string().min(1),
  status: z.enum(["DONE", "FAILED", "CANCELLED"]),
  projectId: z.string().nullable().optional(),
  agentId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
});

function requireServiceKey(req: NextApiRequest, res: NextApiResponse): boolean {
  const key = process.env.AGENT_SERVICE_KEY?.trim();
  if (key && req.headers["x-service-key"] !== key) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function kindFromStatus(status: "DONE" | "FAILED" | "CANCELLED"): AgentActivityKind {
  if (status === "DONE") return "run_completed";
  if (status === "FAILED") return "run_failed";
  return "run_cancelled";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireServiceKey(req, res)) return;

  const parsed = PayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await recordAgentActivityLog({
      userId: parsed.data.userId,
      agentName: parsed.data.agentName,
      kind: kindFromStatus(parsed.data.status),
      projectId: parsed.data.projectId,
      agentId: parsed.data.agentId,
      runId: parsed.data.runId,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[agents] activity log failed:", err);
    return res.status(500).json({ error: "Could not record activity" });
  }
}
