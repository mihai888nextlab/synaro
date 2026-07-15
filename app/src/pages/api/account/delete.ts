import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

function agentHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

type DeleteAccountResponse = { ok: true } | { error: string };

async function deleteUserAgents(userId: string): Promise<void> {
  try {
    const listRes = await fetch(
      `${agentServiceUrl()}/api/agents?userId=${encodeURIComponent(userId)}`,
      { headers: agentHeaders() },
    );
    if (!listRes.ok) return;
    const agents = (await listRes.json()) as Array<{ id: string }>;
    await Promise.allSettled(
      agents.map((agent) =>
        fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(agent.id)}`, {
          method: "DELETE",
          headers: agentHeaders(),
        }),
      ),
    );
  } catch {
    // Best-effort — main account deletion still proceeds
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteAccountResponse>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body as { confirmation?: unknown; password?: unknown };
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true, accounts: { select: { provider: true } } },
  });
  if (!user) return res.status(404).json({ error: "User not found." });

  if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(400).json({ error: "Email confirmation does not match." });
  }

  if (user.passwordHash) {
    if (!password) {
      return res.status(400).json({ error: "Password is required to delete your account." });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(403).json({ error: "Password is incorrect." });
    }
  }

  await deleteUserAgents(userId);
  await prisma.user.delete({ where: { id: userId } });

  return res.status(200).json({ ok: true });
}
