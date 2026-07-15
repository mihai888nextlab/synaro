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

  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  const rawKey = typeof req.query.key === "string" ? req.query.key : "";
  if (!agentId) return res.status(400).json({ error: "Missing agentId" });
  if (!rawKey) return res.status(400).json({ error: "Missing key" });

  const encodedKey = encodeURIComponent(rawKey);

  if (req.method === "PUT") {
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    try {
      const upstream = await fetch(
        `${agentServiceUrl()}/api/agents/${encodeURIComponent(agentId)}/memory/${encodedKey}`,
        {
          method: "PUT",
          headers: agentHeaders(),
          body: JSON.stringify({ userId: session.user.id, content }),
        },
      );
      const data = (await upstream.json()) as unknown;
      return res.status(upstream.status).json(data);
    } catch {
      return res.status(502).json({ error: "Could not reach agent service" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const upstream = await fetch(
        `${agentServiceUrl()}/api/agents/${encodeURIComponent(agentId)}/memory/${encodedKey}`,
        {
          method: "DELETE",
          headers: agentHeaders(),
          body: JSON.stringify({ userId: session.user.id }),
        },
      );
      if (upstream.status === 204) return res.status(204).end();
      const data = (await upstream.json()) as unknown;
      return res.status(upstream.status).json(data);
    } catch {
      return res.status(502).json({ error: "Could not reach agent service" });
    }
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
