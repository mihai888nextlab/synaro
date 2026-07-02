import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import type { KpiMetricKey } from "@/lib/dashboard/layout-schema";

const METRIC_ORDER: KpiMetricKey[] = ["projects", "running", "starting", "stopped_errors"];

const METRIC_LABELS: Record<KpiMetricKey, string> = {
  projects: "Projects",
  running: "Running",
  starting: "Starting",
  stopped_errors: "Stopped / errors",
};

export function pickKpiItem(items: DashboardKpiItem[], metric: KpiMetricKey): DashboardKpiItem {
  const index = METRIC_ORDER.indexOf(metric);
  if (index >= 0 && items[index]) return items[index]!;
  return {
    label: METRIC_LABELS[metric],
    value: "—",
    foot: "No data",
    metricKey: metric,
    footKey: "dashboard.kpiNoData",
  };
}
