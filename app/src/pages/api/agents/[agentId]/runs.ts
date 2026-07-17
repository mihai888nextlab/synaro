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

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  if (!agentId) return res.status(400).json({ error: "Missing agentId" });

  try {
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "20";
    const compact = req.query.compact === "1" || req.query.compact === "true";
    const params = new URLSearchParams({
      limit: limitRaw,
      ...(compact ? { compact: "1" } : {}),
    });
    const upstream = await fetch(
      `${agentServiceUrl()}/api/agents/${agentId}/runs?${params.toString()}`,
      { headers: agentHeaders() },
    );
    const data = (await upstream.json()) as unknown;
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Could not reach agent service" });
  }
}
