"use client";

import { useMemo } from "react";

import { AgentLastRunWidget } from "@/components/ui/dashboard/widgets/agent-widgets";
import { DashboardKpiStrip, type DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import { useTranslation } from "@/components/ui/locale-provider";
import type {
  DashboardLayout,
  DashboardPageData,
  DashboardWidgetInstance,
  KpiMetricKey,
} from "@/lib/dashboard/layout-schema";
import { resolveMobileLastRunAgents } from "@/lib/dashboard/mobile-monitor";

const KPI_LABEL_KEYS: Record<KpiMetricKey, string> = {
  projects: "dashboard.kpiProjects",
  running: "dashboard.kpiRunning",
  starting: "dashboard.kpiStarting",
  stopped_errors: "dashboard.kpiStoppedErrors",
};

function syntheticLastRunWidget(agentId: string): DashboardWidgetInstance {
  return {
    id: `mobile-last-run-${agentId}`,
    type: "agent_last_run",
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    config: { agentId },
  };
}

type DashboardMobileMonitorProps = {
  layout: DashboardLayout;
  data: DashboardPageData;
};

export function DashboardMobileMonitor({ layout, data }: DashboardMobileMonitorProps) {
  const { t } = useTranslation();

  const kpiItems: DashboardKpiItem[] = useMemo(
    () =>
      data.kpiItems.map((item) => ({
        ...item,
        label: item.metricKey ? t(KPI_LABEL_KEYS[item.metricKey]) : item.label,
        foot: item.footKey ? t(item.footKey, item.footParams) : item.foot,
      })),
    [data.kpiItems, t],
  );

  const lastRunAgents = useMemo(
    () => resolveMobileLastRunAgents(layout, data.agents),
    [layout, data.agents],
  );

  return (
    <div className="flex flex-col gap-4">
      <DashboardKpiStrip items={kpiItems} />

      {lastRunAgents.map(({ agentId }) => (
        <div key={agentId} className="h-[min(70vh,28rem)] min-h-[16rem]">
          <AgentLastRunWidget
            variant="live"
            layoutMode="grid"
            widget={syntheticLastRunWidget(agentId)}
            data={data}
          />
        </div>
      ))}
    </div>
  );
}
