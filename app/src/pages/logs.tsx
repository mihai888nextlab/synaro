import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import { DashboardLogsTable, type DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { getUserActivityLogs } from "@/lib/activity-log";
import { authOptions } from "@/lib/next-auth-options";

type LogsPageProps = {
  logs: DashboardLogRow[];
};

export default function LogsPage({ logs }: LogsPageProps) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col overflow-hidden">
      <DashboardLogsTable
        hideHeader
        frameless
        logs={logs}
        emptyMessage="Start or stop a project container to record activity. Logs reset each day."
        className="flex min-h-0 flex-1 max-h-[calc(100dvh-11rem)]"
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<LogsPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const logs = await getUserActivityLogs(session.user.id, {
    limit: 200,
    timeFormat: "datetime",
  });
  return { props: { logs } };
};
