import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
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

  const runId = typeof req.query.runId === "string" ? req.query.runId : "";
  if (!runId) return res.status(400).json({ error: "Missing runId" });

  const body = req.body as { mcpAuth?: Record<string, Record<string, string>> };
  if (!body.mcpAuth || typeof body.mcpAuth !== "object") {
    return res.status(400).json({ error: "mcpAuth object required" });
  }

  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/runs/${encodeURIComponent(runId)}/credentials`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ userId: session.user.id, mcpAuth: body.mcpAuth }),
    });
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
