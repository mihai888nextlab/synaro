import type { GetServerSideProps } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardKpiStrip } from "@/components/ui/dashboard-kpi-strip";
import { DashboardLogsTable } from "@/components/ui/dashboard-logs-table";
import { DashboardProjectsShowcase } from "@/components/ui/dashboard-projects-showcase";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";

export default function DashboardPage() {
  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 sm:gap-10">
        <DashboardKpiStrip />

        <DashboardProjectsShowcase />

        <DashboardLogsTable
          headerEnd={
            <Button variant="outline" size="sm" className="rounded-xl text-muted-foreground" asChild>
              <Link href="/logs">View logs</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
