import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import { DashboardPageClient } from "@/components/ui/dashboard/dashboard-page-client";
import type { SynaroAgentCardModel } from "@/components/ui/agent-cards-grid";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
import { getUserDashboardLayout } from "@/lib/dashboard/layout-storage";
import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { getUserAgentCards } from "@/lib/user-agents";
import { getDashboardProjectPayload } from "@/lib/user-project-cards";

type DashboardPageProps = {
  initialLayout: DashboardLayout;
  isDefaultLayout: boolean;
  projects: SynaroProjectCardModel[];
  agents: SynaroAgentCardModel[];
  kpiItems: DashboardKpiItem[];
  activityLogs: DashboardLogRow[];
  apiKeysCount: number;
};

export default function DashboardPage(props: DashboardPageProps) {
  return <DashboardPageClient {...props} />;
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const userId = session.user.id;

  const [{ projects, kpiItems, activityLogs }, agents, storedLayout, apiKeysCount] =
    await Promise.all([
      getDashboardProjectPayload(userId),
      getUserAgentCards(userId),
      getUserDashboardLayout(userId),
      prisma.apiKey.count({ where: { userId, revokedAt: null } }),
    ]);

  return {
    props: {
      initialLayout: storedLayout ?? DEFAULT_DASHBOARD_LAYOUT,
      isDefaultLayout: storedLayout === null,
      projects,
      agents,
      kpiItems,
      activityLogs,
      apiKeysCount,
    },
  };
};
