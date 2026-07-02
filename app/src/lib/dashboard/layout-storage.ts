import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
import { parseDashboardLayout, validateDashboardLayout } from "@/lib/dashboard/validate-layout";

export async function getUserDashboardLayout(userId: string): Promise<DashboardLayout | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardLayout: true },
  });
  if (!user?.dashboardLayout) return null;
  return parseDashboardLayout(user.dashboardLayout);
}

export async function saveUserDashboardLayout(
  userId: string,
  layout: DashboardLayout,
  ctx: { projectIds: Set<string>; agentIds: Set<string> },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateDashboardLayout(layout, ctx);
  if (!validated.ok) return validated;

  await prisma.user.update({
    where: { id: userId },
    data: {
      dashboardLayout: validated.layout,
      dashboardLayoutVersion: validated.layout.version,
    },
  });

  return { ok: true };
}

export async function resetUserDashboardLayout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      dashboardLayout: Prisma.DbNull,
      dashboardLayoutVersion: DEFAULT_DASHBOARD_LAYOUT.version,
    },
  });
}
