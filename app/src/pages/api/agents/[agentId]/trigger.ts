import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { recordAgentActivityLog } from "@/lib/activity-log";
import { authOptions } from "@/lib/next-auth-options";

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}
function agentHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "Missing agentId" });

  try {
    let agentName = "Agent";
    const agentRes = await fetch(`${agentServiceUrl()}/api/agents/${agentId}`, {
      headers: agentHeaders(),
    });
    if (agentRes.ok && agentRes.status === 200) {
      try {
        const agent = (await agentRes.json()) as { name?: string };
        if (typeof agent.name === "string" && agent.name.trim()) agentName = agent.name;
      } catch {
        // Upstream may return an empty body; keep default agent name.
      }
    }

    const upstream = await fetch(`${agentServiceUrl()}/api/agents/${agentId}/trigger`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify(req.body ?? {}),
    });
    const data = (await upstream.json()) as { runId?: string } | unknown;
    if (upstream.ok || upstream.status === 202) {
      const runId =
        data && typeof data === "object" && "runId" in data && typeof data.runId === "string"
          ? data.runId
          : undefined;
      void recordAgentActivityLog({
        userId: session.user.id,
        agentName,
        kind: "run_started",
        agentId,
        runId,
      }).catch((err) => {
        console.error("[agents] activity log (run_started) failed:", err);
      });
    }
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
