import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
import type { LayoutValidationContext } from "@/lib/dashboard/validate-layout";
import {
  getUserDashboardLayout,
  resetUserDashboardLayout,
  saveUserDashboardLayout,
} from "@/lib/dashboard/layout-storage";
import { parseDashboardLayout } from "@/lib/dashboard/validate-layout";
import { authOptions } from "@/lib/next-auth-options";
import { getUserAgentCards } from "@/lib/user-agents";
import { getUserProjectCardsWithRows } from "@/lib/user-project-cards";

type GetResponse = { layout: DashboardLayout; isDefault: boolean } | { error: string };

async function validationContext(userId: string): Promise<LayoutValidationContext> {
  const [{ rows }, agents] = await Promise.all([
    getUserProjectCardsWithRows(userId),
    getUserAgentCards(userId),
  ]);

  // getUserAgentCards returns [] on upstream failure — skip ownership checks so
  // geometry saves still succeed when agent-service is temporarily unreachable.
  const agentsLookupOk = await probeAgentService(userId);

  return {
    projectIds: new Set(rows.map((row) => row.id)),
    agentIds: new Set(agents.map((agent) => agent.id)),
    skipAgentOwnershipCheck: !agentsLookupOk,
  };
}

async function probeAgentService(userId: string): Promise<boolean> {
  try {
    const base = process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
    const res = await fetch(`${base}/api/agents?userId=${encodeURIComponent(userId)}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const stored = await getUserDashboardLayout(userId);
    const layout = stored ?? DEFAULT_DASHBOARD_LAYOUT;
    return res.status(200).json({ layout, isDefault: stored === null } satisfies GetResponse);
  }

  if (req.method === "PUT") {
    const parsed = parseDashboardLayout(req.body);
    if (!parsed) {
      return res.status(400).json({ error: "Invalid layout payload" });
    }

    const ctx = await validationContext(userId);
    const saved = await saveUserDashboardLayout(userId, parsed, ctx);
    if (!saved.ok) {
      console.error("[dashboard-layout] save rejected:", saved.error);
      return res.status(400).json({ error: saved.error });
    }

    return res.status(200).json({ layout: saved.layout });
  }

  if (req.method === "POST" && req.query.reset === "1") {
    await resetUserDashboardLayout(userId);
    return res.status(200).json({ layout: DEFAULT_DASHBOARD_LAYOUT, isDefault: true });
  }

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
