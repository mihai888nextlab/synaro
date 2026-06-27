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

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const runId = typeof req.query.runId === "string" ? req.query.runId : "";
  if (!runId) return res.status(400).json({ error: "Missing runId" });

  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/runs/${runId}`, {
      headers: agentHeaders(),
    });
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
