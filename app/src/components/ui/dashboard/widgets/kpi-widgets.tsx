"use client";

import { DashboardKpiStrip } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { useTranslation } from "@/components/ui/locale-provider";
import { pickKpiItem } from "@/lib/dashboard/kpi-metrics";
import type { KpiClusterLayoutMode, KpiMetricKey } from "@/lib/dashboard/layout-schema";
import { widgetRootClass, widgetChildClass } from "@/components/ui/dashboard/widget-layout-utils";
import {
  getWidgetDensity,
  kpiLayoutGridClass,
  resolveKpiLayoutMode,
} from "@/lib/dashboard/widget-size-utils";
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

function KpiMetricCard({
  item,
  density,
  className,
}: {
  item: DashboardKpiItem;
  density: ReturnType<typeof getWidgetDensity>;
  className?: string;
}) {
  return (
    <article className={cn(kpiCardShell, className)}>
      <p
        className={cn(
          "font-medium uppercase tracking-[0.08em] text-muted-foreground",
          density === "compact" ? "text-[0.65rem]" : "text-xs",
        )}
      >
        {item.label}
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums tracking-tight text-foreground",
          density === "compact" && "mt-2 text-2xl",
          density === "normal" && "mt-4 text-3xl sm:text-[2rem] sm:leading-none",
          density === "expanded" && "mt-4 text-4xl sm:text-[2.25rem] sm:leading-none",
        )}
      >
        {item.value}
      </p>
      {density !== "compact" ? (
        <p
          className={cn(
            "mt-auto text-xs leading-relaxed text-muted-foreground",
            density === "normal" && "pt-4 sm:pt-5",
            density === "expanded" && "pt-5 sm:pt-6",
            item.footPositive && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {item.foot}
        </p>
      ) : null}
    </article>
  );
}

function KpiMetricsGrid({
  items,
  w,
  h,
  layoutMode,
  preferredLayout,
  className,
}: {
  items: DashboardKpiItem[];
  w: number;
  h: number;
  layoutMode: DashboardWidgetRenderProps["layoutMode"];
  preferredLayout?: KpiClusterLayoutMode;
  className?: string;
}) {
  const mode = resolveKpiLayoutMode(w, h, preferredLayout);
  const density = getWidgetDensity(w, h);

  return (
    <div className={cn(kpiLayoutGridClass(mode), layoutMode === "fluid" && "h-auto", className)}>
      {items.map((item) => (
        <KpiMetricCard key={item.metricKey ?? item.label} item={item} density={density} />
      ))}
    </div>
  );
}

export function KpiStripWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const translatedItems = useTranslatedKpiItems(data.kpiItems);
  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <KpiMetricsGrid
        items={translatedItems}
        w={widget.w}
        h={widget.h}
        layoutMode={layoutMode}
        className={widgetChildClass(layoutMode)}
      />
    </div>
  );
}

export function KpiClusterWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const translatedItems = useTranslatedKpiItems(data.kpiItems);
  const preferred = (widget.config as { layout?: KpiClusterLayoutMode } | undefined)?.layout;

  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <KpiMetricsGrid
        items={translatedItems}
        w={widget.w}
        h={widget.h}
        layoutMode={layoutMode}
        preferredLayout={preferred}
        className={widgetChildClass(layoutMode)}
      />
    </div>
  );
}

export function SingleKpiWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const metric = (widget.config as { metric?: KpiMetricKey } | undefined)?.metric ?? "projects";
  const item = pickKpiItem(data.kpiItems, metric);
  const label = item.metricKey ? t(KPI_LABEL_KEYS[item.metricKey]) : item.label;
  const foot = item.footKey ? t(item.footKey, item.footParams) : item.foot;
  const density = getWidgetDensity(widget.w, widget.h);

  return (
    <article
      className={cn(
        kpiCardShell,
        layoutMode === "grid" ? "h-full justify-between" : "h-auto",
        variant === "preview" && "scale-[0.98]",
      )}
    >
      <p
        className={cn(
          "font-medium uppercase tracking-[0.08em] text-muted-foreground",
          density === "compact" ? "text-[0.65rem]" : "text-xs",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums tracking-tight text-foreground",
          density === "compact" && "mt-2 text-2xl",
          density === "normal" && "mt-4 text-3xl",
          density === "expanded" && "mt-4 text-4xl",
        )}
      >
        {item.value}
      </p>
      {density !== "compact" ? (
        <p
          className={cn(
            "mt-auto pt-4 text-xs text-muted-foreground",
            item.footPositive && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {foot}
        </p>
      ) : null}
    </article>
  );
}
