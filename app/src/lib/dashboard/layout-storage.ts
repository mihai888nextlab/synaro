import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
import type { LayoutValidationContext } from "@/lib/dashboard/validate-layout";
import { parseDashboardLayout, validateDashboardLayout } from "@/lib/dashboard/validate-layout";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
  ctx: LayoutValidationContext,
): Promise<{ ok: true; layout: DashboardLayout } | { ok: false; error: string }> {
  const validated = validateDashboardLayout(layout, ctx);
  if (!validated.ok) return validated;

  await prisma.user.update({
    where: { id: userId },
    data: {
      dashboardLayout: validated.layout,
      dashboardLayoutVersion: validated.layout.version,
    },
  });

  return { ok: true, layout: validated.layout };
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
