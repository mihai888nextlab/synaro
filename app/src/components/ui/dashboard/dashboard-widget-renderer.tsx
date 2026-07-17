"use client";

import type { ComponentType } from "react";

import {
  ActivityFeedCompactWidget,
  ActivityLogWidget,
} from "@/components/ui/dashboard/widgets/activity-widgets";
import { KpiStripWidget, SingleKpiWidget, KpiClusterWidget } from "@/components/ui/dashboard/widgets/kpi-widgets";
import {
  AgentsShowcaseWidget,
  ProjectsShowcaseWidget,
} from "@/components/ui/dashboard/widgets/showcase-widgets";
import { AgentLastRunWidget } from "@/components/ui/dashboard/widgets/agent-widgets";
import {
  AgentShortcutWidget,
  ApiKeysSummaryWidget,
  PageShortcutWidget,
  ProjectShortcutWidget,
} from "@/components/ui/dashboard/widgets/shortcut-widgets";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import type { WidgetType } from "@/lib/dashboard/layout-schema";

const WIDGET_COMPONENTS: Record<WidgetType, ComponentType<DashboardWidgetRenderProps>> = {
  kpi_strip: KpiStripWidget,
  kpi_cluster: KpiClusterWidget,
  single_kpi: SingleKpiWidget,
  projects_showcase: ProjectsShowcaseWidget,
  agents_showcase: AgentsShowcaseWidget,
  activity_log: ActivityLogWidget,
  activity_feed_compact: ActivityFeedCompactWidget,
  page_shortcut: PageShortcutWidget,
  project_shortcut: ProjectShortcutWidget,
  agent_shortcut: AgentShortcutWidget,
  agent_last_run: AgentLastRunWidget,
  api_keys_summary: ApiKeysSummaryWidget,
};

export function DashboardWidgetRenderer(props: DashboardWidgetRenderProps) {
  const Component = WIDGET_COMPONENTS[props.widget.type];
  if (!Component) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
        Unknown widget: {props.widget.type}
      </div>
    );
  }
  return <Component {...props} />;
}
