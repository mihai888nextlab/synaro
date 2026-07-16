import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import { buildAgentMetricsSidebarTemplate } from "@/lib/dashboard/layout-templates";

describe("layout-templates", () => {
  it("builds agent last run + KPI cluster sidebar layout", () => {
    const next = buildAgentMetricsSidebarTemplate(DEFAULT_DASHBOARD_LAYOUT, {
      agentId: "agent-1",
    });

    expect(next).not.toBeNull();
    const added = next!.widgets.slice(DEFAULT_DASHBOARD_LAYOUT.widgets.length);
    expect(added).toHaveLength(2);

    const agentWidget = added.find((w) => w.type === "agent_last_run");
    const kpiWidget = added.find((w) => w.type === "kpi_cluster");

    expect(agentWidget).toMatchObject({ x: 0, w: 6, h: 4, config: { agentId: "agent-1" } });
    expect(kpiWidget).toMatchObject({ x: 6, w: 6, h: 4, config: { layout: "grid" } });
    expect(agentWidget!.y).toBe(kpiWidget!.y);
  });

  it("returns null without an agent id", () => {
    expect(buildAgentMetricsSidebarTemplate(DEFAULT_DASHBOARD_LAYOUT, {})).toBeNull();
  });
});
