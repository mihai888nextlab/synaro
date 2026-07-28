import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const DEMO_DOMAIN = process.env.DEMO_EMAIL_DOMAIN?.trim() || "synaro.demo";

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

/**
 * Clone the admin's agents (+ memory + run history) into a demo account — standalone, independent of
 * cloning a project. Agents come across as global (no project link) since no project is specified.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const body = req.body as { targetUserId?: string; agentIds?: string[] };
  if (!body.targetUserId) return res.status(400).json({ error: "targetUserId is required" });
  const agentIds = Array.isArray(body.agentIds) ? body.agentIds.filter((x) => typeof x === "string") : undefined;

  const target = await prisma.user.findUnique({
    where: { id: body.targetUserId },
    select: { id: true, email: true },
  });
  if (!target) return res.status(404).json({ error: "Target account not found" });
  if (!target.email.endsWith(`@${DEMO_DOMAIN}`)) {
    return res.status(403).json({ error: "Target is not a demo account" });
  }

  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/agents/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
      },
      body: JSON.stringify({
        fromUserId: adminId,
        toUserId: body.targetUserId,
        ...(agentIds && agentIds.length > 0 ? { agentIds } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(502).json({ error: text || `agents/clone failed (${upstream.status})` });
    }
    const data = (await upstream.json().catch(() => ({}))) as { clonedAgents?: number; clonedRuns?: number };
    return res.json({ clonedAgents: data.clonedAgents ?? 0, clonedRuns: data.clonedRuns ?? 0 });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
