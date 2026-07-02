"use client";

import Link from "next/link";

import { useTranslation } from "@/components/ui/locale-provider";
import { DashboardSectionLink } from "@/components/ui/dashboard-section-link";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import {
  DASHBOARD_PLACEHOLDER_LOGS,
  DashboardLogsTable,
} from "@/components/ui/dashboard-logs-table";
import { widgetRootClass, widgetChildClass } from "@/components/ui/dashboard/widget-layout-utils";
import { cn } from "@/lib/utils";

export function ActivityLogWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const logs = variant === "preview" ? DASHBOARD_PLACEHOLDER_LOGS.slice(0, 4) : data.activityLogs;
  const fluid = layoutMode === "fluid";
  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <DashboardLogsTable
        logs={logs}
        headerEnd={<DashboardSectionLink href="/logs" label={t("dashboard.viewLogs")} />}
        className={widgetChildClass(layoutMode)}
        expandContent={fluid}
      />
    </div>
  );
}

const statusTone: Record<string, string> = {
  done: "text-emerald-600 dark:text-emerald-400",
  running: "text-blue-500",
  stopped: "text-muted-foreground",
};

export function ActivityFeedCompactWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const logs = (variant === "preview" ? DASHBOARD_PLACEHOLDER_LOGS : data.activityLogs).slice(0, 5);
  const fluid = layoutMode === "fluid";

  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border/50 dark:bg-card/90",
        fluid ? "h-auto overflow-visible" : "h-full overflow-hidden",
        variant === "preview" && "pointer-events-none",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-foreground">
          {t("widgets.types.activity_feed_compact.title")}
        </h3>
        <Link href="/logs" className="text-xs text-muted-foreground hover:text-foreground">
          {t("dashboard.viewLogs")}
        </Link>
      </div>
      <ul
        className={cn(
          "flex flex-col gap-0 divide-y divide-border/50 px-4 py-2 sm:px-5",
          fluid ? "overflow-visible" : "flex-1 overflow-auto",
        )}
      >
        {logs.map((log) => (
          <li key={log.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{log.action}</p>
              <p className="text-xs text-muted-foreground">{log.project}</p>
            </div>
            <span className={cn("shrink-0 text-xs capitalize", statusTone[log.status])}>{log.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
