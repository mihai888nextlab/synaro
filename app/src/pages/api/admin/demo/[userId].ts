import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import {
  destroyAllRemoteEnvironmentsForProject,
  remoteDestroyDeployment,
} from "@/lib/environment-service-api";

const DEMO_DOMAIN = process.env.DEMO_EMAIL_DOMAIN?.trim() || "synaro.demo";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}
function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}
function agentHeaders() {
  return { "Content-Type": "application/json", "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "" };
}

/** Remove a project's chat history from the AI service. */
async function deleteProjectTasks(projectId: string): Promise<void> {
  await fetch(`${aiServiceBaseUrl()}/api/tasks?projectId=${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  }).catch(() => {});
}

/** Delete every agent (and its runs/memory, via cascade) owned by a user in the agent service. */
async function deleteUserAgents(userId: string): Promise<void> {
  try {
    const listRes = await fetch(`${agentServiceUrl()}/api/agents?userId=${encodeURIComponent(userId)}`, {
      headers: agentHeaders(),
    });
    if (!listRes.ok) return;
    const agents = (await listRes.json()) as Array<{ id: string }>;
    await Promise.allSettled(
      agents.map((a) =>
        fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(a.id)}`, {
          method: "DELETE",
          headers: agentHeaders(),
        }),
      ),
    );
  } catch {
    // best-effort
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).end();
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, projects: { select: { id: true } } },
  });
  if (!user) return res.status(404).json({ error: "Account not found" });

  // Safety: only demo accounts may be deleted here — never a real user.
  if (!user.email.endsWith(`@${DEMO_DOMAIN}`)) {
    return res.status(403).json({ error: "Refusing to delete a non-demo account" });
  }

  // Tear down each project's runtime + deployment + chat history (containers/volumes are external
  // to the app DB, so the cascade on user.delete would otherwise orphan them).
  for (const p of user.projects) {
    await destroyAllRemoteEnvironmentsForProject(p.id).catch(() => {});
    await remoteDestroyDeployment(p.id).catch(() => {});
    await deleteProjectTasks(p.id);
  }

  // Agents live in the agent service, keyed by userId.
  await deleteUserAgents(userId);

  // Cascades projects, members, activity logs, api keys, sessions in the app DB.
  await prisma.user.delete({ where: { id: userId } });

  return res.status(200).json({ ok: true });
}
