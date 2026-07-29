import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const DEMO_DOMAIN = process.env.DEMO_EMAIL_DOMAIN?.trim() || "synaro.demo";

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

function agentHeaders() {
  return { "Content-Type": "application/json", "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "" };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const body = req.body as { userId?: string; agentIds?: string[] };
  if (!body.userId) return res.status(400).json({ error: "userId is required" });

  const user = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, email: true },
  });
  if (!user) return res.status(404).json({ error: "Account not found" });
  if (!user.email.endsWith(`@${DEMO_DOMAIN}`)) {
    return res.status(403).json({ error: "Refusing to delete agents from a non-demo account" });
  }

  const agentIds = Array.isArray(body.agentIds) ? body.agentIds.filter((x) => typeof x === "string") : null;

  try {
    // If specific agents given, delete them directly.
    if (agentIds && agentIds.length > 0) {
      await Promise.allSettled(
        agentIds.map((id) =>
          fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: agentHeaders(),
          }),
        ),
      );
      return res.json({ deleted: agentIds.length });
    }

    // Otherwise delete all agents owned by this user.
    const listRes = await fetch(`${agentServiceUrl()}/api/agents?userId=${encodeURIComponent(body.userId)}`, {
      headers: agentHeaders(),
    });
    if (!listRes.ok) return res.json({ deleted: 0 });

    const agents = (await listRes.json()) as Array<{ id: string }>;
    await Promise.allSettled(
      agents.map((a) =>
        fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(a.id)}`, {
          method: "DELETE",
          headers: agentHeaders(),
        }),
      ),
    );
    return res.json({ deleted: agents.length });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
