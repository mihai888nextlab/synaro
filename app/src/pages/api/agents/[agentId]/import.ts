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

type CopyResponse = {
  agent?: { id?: string; name?: string };
  alreadyOwned?: boolean;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "Missing agentId" });

  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(agentId)}/copy`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ toUserId: session.user.id }),
    });
    const data = (await upstream.json().catch(() => ({}))) as CopyResponse;
    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    const agent = data.agent;
    const newId = typeof agent?.id === "string" ? agent.id : "";
    const name = typeof agent?.name === "string" && agent.name.trim() ? agent.name : "Agent";

    if (!data.alreadyOwned && newId) {
      void recordAgentActivityLog({
        userId: session.user.id,
        agentName: name,
        kind: "created",
        agentId: newId,
      }).catch(() => undefined);
    }

    return res.status(upstream.status).json({
      id: newId,
      name,
      alreadyOwned: Boolean(data.alreadyOwned),
    });
  } catch {
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
