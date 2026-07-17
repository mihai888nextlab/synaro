import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { sendAgentRunCompleteEmail } from "@/lib/agents/send-run-complete-email";

const PayloadSchema = z.object({
  runId: z.string().min(1),
  agentId: z.string().min(1),
  userId: z.string().min(1),
  agentName: z.string().min(1),
  status: z.enum(["DONE", "FAILED"]),
  trigger: z.string(),
  output: z.string().nullable(),
  finishedAt: z.string().min(1),
});

function requireServiceKey(req: NextApiRequest, res: NextApiResponse): boolean {
  const key = process.env.AGENT_SERVICE_KEY?.trim();
  if (key && req.headers["x-service-key"] !== key) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
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

  const result = await sendAgentRunCompleteEmail(parsed.data);
  if (!result.ok) {
    return res.status(503).json({ error: result.reason });
  }

  return res.status(200).json({ ok: true, skipped: "skipped" in result ? result.skipped : false });
}
