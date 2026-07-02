"use client";

import { DashboardKpiStrip } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { useTranslation } from "@/components/ui/locale-provider";
import { pickKpiItem } from "@/lib/dashboard/kpi-metrics";
import type { KpiMetricKey } from "@/lib/dashboard/layout-schema";
import { widgetRootClass, widgetChildClass } from "@/components/ui/dashboard/widget-layout-utils";
import { cn } from "@/lib/utils";

const kpiCardShell =
  "flex h-full min-w-0 flex-col rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25 max-sm:px-4 max-sm:py-3 sm:px-6 sm:py-5";

const KPI_LABEL_KEYS: Record<KpiMetricKey, string> = {
  projects: "dashboard.kpiProjects",
  running: "dashboard.kpiRunning",
  starting: "dashboard.kpiStarting",
  stopped_errors: "dashboard.kpiStoppedErrors",
};

function useTranslatedKpiItems(items: DashboardKpiItem[]): DashboardKpiItem[] {
  const { t } = useTranslation();
  return items.map((item) => ({
    ...item,
    label: item.metricKey ? t(KPI_LABEL_KEYS[item.metricKey]) : item.label,
    foot: item.footKey ? t(item.footKey, item.footParams) : item.foot,
  }));
}

export function KpiStripWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const translatedItems = useTranslatedKpiItems(data.kpiItems);
  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <DashboardKpiStrip items={translatedItems} className={widgetChildClass(layoutMode)} />
    </div>
  );
}

export function SingleKpiWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const metric = (widget.config as { metric?: KpiMetricKey } | undefined)?.metric ?? "projects";
  const item = pickKpiItem(data.kpiItems, metric);
  const label = item.metricKey ? t(KPI_LABEL_KEYS[item.metricKey]) : item.label;
  const foot = item.footKey ? t(item.footKey, item.footParams) : item.foot;

  return (
    <article
      className={cn(
        kpiCardShell,
        layoutMode === "grid" ? "h-full justify-between" : "h-auto",
        variant === "preview" && "scale-[0.98]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{item.value}</p>
      <p className="mt-auto pt-4 text-xs text-muted-foreground">{foot}</p>
    </article>
  );
}