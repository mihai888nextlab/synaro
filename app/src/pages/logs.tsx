import type { GetServerSideProps } from "next";

import { DashboardLogsTable, LOG_PAGE_PLACEHOLDER_LOGS } from "@/components/ui/dashboard-logs-table";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";

export default function LogsPage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageBackgroundPattern variant="section" className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      <div className="relative z-10 mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col">
        <DashboardLogsTable
          hideHeader
          frameless
          logs={LOG_PAGE_PLACEHOLDER_LOGS}
          className="flex min-h-0 flex-1 max-h-[calc(100dvh-11rem)]"
        />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
