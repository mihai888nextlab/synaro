import type { GetServerSideProps } from "next";

import { DashboardLogsTable, type DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { useTranslation } from "@/components/ui/locale-provider";
import { getUserActivityLogs } from "@/lib/activity-log";
import { requireSession } from "@/lib/auth/require-session";

type LogsPageProps = {
  logs: DashboardLogRow[];
};

export default function LogsPage({ logs }: LogsPageProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col overflow-hidden">
      <DashboardLogsTable
        hideHeader
        frameless
        logs={logs}
        emptyMessage={t("logs.noLogsPageBody")}
        className="flex min-h-0 flex-1 max-h-[calc(100dvh-11rem)]"
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<LogsPageProps> = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const logs = await getUserActivityLogs(auth.userId, {
    limit: 200,
    timeFormat: "datetime",
  });
  return { props: { logs } };
};
