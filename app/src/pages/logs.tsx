import type { GetServerSideProps } from "next";

import { DashboardLogsTable, LOG_PAGE_PLACEHOLDER_LOGS } from "@/components/ui/dashboard-logs-table";
import { requireAuth } from "@/lib/auth-redirect";

export default function LogsPage() {
  return (
    <div className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col overflow-hidden">
      <DashboardLogsTable
        hideHeader
        frameless
        logs={LOG_PAGE_PLACEHOLDER_LOGS}
        className="flex min-h-0 flex-1 max-h-[calc(100dvh-11rem)]"
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
