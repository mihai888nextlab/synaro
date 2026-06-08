import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import { DashboardKpiStrip, type DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import { DashboardSectionLink } from "@/components/ui/dashboard-section-link";
import { DashboardLogsTable, type DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { DashboardProjectsShowcase } from "@/components/ui/dashboard-projects-showcase";
import { authOptions } from "@/lib/next-auth-options";
import { getDashboardProjectPayload } from "@/lib/user-project-cards";

type DashboardPageProps = {
  projects: SynaroProjectCardModel[];
  kpiItems: DashboardKpiItem[];
  activityLogs: DashboardLogRow[];
};

export default function DashboardPage({ projects, kpiItems, activityLogs }: DashboardPageProps) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 sm:gap-10">
      <DashboardKpiStrip items={kpiItems} />

      <DashboardProjectsShowcase projects={projects} />

      <DashboardLogsTable
        logs={activityLogs}
        headerEnd={<DashboardSectionLink href="/logs" label="View logs" />}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const { projects, kpiItems, activityLogs } = await getDashboardProjectPayload(session.user.id);
  return { props: { projects, kpiItems, activityLogs } };
};
