import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
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

async function validationContext(userId: string) {
  const [{ rows }, agents] = await Promise.all([
    getUserProjectCardsWithRows(userId),
    getUserAgentCards(userId),
  ]);
  return {
    projectIds: new Set(rows.map((row) => row.id)),
    agentIds: new Set(agents.map((agent) => agent.id)),
  };
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
      return res.status(400).json({ error: saved.error });
    }

    return res.status(200).json({ layout: parsed });
  }

  if (req.method === "POST" && req.query.reset === "1") {
    await resetUserDashboardLayout(userId);
    return res.status(200).json({ layout: DEFAULT_DASHBOARD_LAYOUT, isDefault: true });
  }

  res.setHeader("Allow", "GET, PUT, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
