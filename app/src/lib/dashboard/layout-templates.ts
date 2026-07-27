import { createWidgetId, type DashboardLayout, type DashboardWidgetInstance } from "@/lib/dashboard/layout-schema";

export type LayoutTemplateInput = {
  agentId?: string;
};

/** Agent last-run visuals (left) + KPI cluster 2×2 (right) — same 6×4 height. */
export function buildAgentMetricsSidebarTemplate(
  layout: DashboardLayout,
  input: LayoutTemplateInput,
): DashboardLayout | null {
  if (!input.agentId) return null;

  const maxY = layout.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  const widgets: DashboardWidgetInstance[] = [
    {
      id: createWidgetId(),
      type: "agent_last_run_generated",
      x: 0,
      y: maxY,
      w: 6,
      h: 4,
      config: { agentId: input.agentId },
    },
    {
      id: createWidgetId(),
      type: "kpi_cluster",
      x: 6,
      y: maxY,
      w: 6,
      h: 4,
      config: { layout: "grid" },
    },
  ];

  return {
    ...layout,
    widgets: [...layout.widgets, ...widgets],
  };
}
