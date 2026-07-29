import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { sendAgentRunCompleteEmail } from "@/lib/agents/send-run-complete-email";

// Agent runs carry full output + artifacts; the default 1mb body cap rejects large
// runs *before* the handler runs, surfacing as a silent 500 _error page. Give it room.
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

const PayloadSchema = z.object({
  runId: z.string().min(1),
  agentId: z.string().min(1),
  userId: z.string().min(1),
  agentName: z.string().min(1),
  status: z.enum(["DONE", "FAILED"]),
  trigger: z.string(),
  output: z.string().nullable(),
  artifacts: z.unknown().optional(),
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

  try {
    // Access req.body inside the try: an oversized body throws here (before the handler
    // could otherwise catch it), which previously bubbled up as a silent HTML _error page.
    const parsed = PayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const result = await sendAgentRunCompleteEmail(parsed.data);
    if (!result.ok) {
      console.warn(`[agents] run email NOT sent — ${result.reason} (user ${parsed.data.userId}, run ${parsed.data.runId})`);
      return res.status(503).json({ error: result.reason });
    }
    const skipped = "skipped" in result && result.skipped === true;
    console.info(
      `[agents] run email ${skipped ? `SKIPPED (${(result as { reason?: string }).reason})` : "sent"} — user ${parsed.data.userId}, run ${parsed.data.runId}`,
    );
    return res.status(200).json({ ok: true, skipped });
  } catch (err) {
    // Without this, a throw here returns Next's HTML _error page and the email is lost silently.
    console.error("[agents] agent-run-email route failed:", err);
    return res.status(500).json({ error: "Could not send run email" });
  }
}
