import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import { createWidgetId } from "@/lib/dashboard/layout-schema";
import {
  appendWidget,
  validateDashboardLayout,
} from "@/lib/dashboard/validate-layout";

describe("validate-dashboard-layout", () => {
  const ctx = {
    projectIds: new Set(["p1"]),
    agentIds: new Set(["a1"]),
  };

  it("accepts the default layout", () => {
    const result = validateDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, ctx);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown widget types", () => {
    const result = validateDashboardLayout(
      {
        version: 1,
        widgets: [
          {
            id: "x",
            type: "unknown" as never,
            x: 0,
            y: 0,
            w: 3,
            h: 2,
          },
        ],
      },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("appends widgets at the next row", () => {
    const id = createWidgetId();
    const next = appendWidget(DEFAULT_DASHBOARD_LAYOUT, {
      id,
      type: "page_shortcut",
      w: 3,
      h: 2,
      config: { route: "logs" },
    });
    const added = next.widgets.find((widget) => widget.id === id);
    expect(added?.y).toBe(16);
  });

  it("accepts agent_last_run_generated with a valid agent", () => {
    const result = validateDashboardLayout(
      {
        version: 1,
        widgets: [
          {
            id: "last-run-gen",
            type: "agent_last_run_generated",
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            config: { agentId: "a1" },
          },
        ],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects agent_last_run_generated without a valid agent", () => {
    const result = validateDashboardLayout(
      {
        version: 1,
        widgets: [
          {
            id: "last-run-gen",
            type: "agent_last_run_generated",
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            config: { agentId: "missing" },
          },
        ],
      },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts resized agent_last_run_generated and kpi_cluster side by side", () => {
    const result = validateDashboardLayout(
      {
        version: 1,
        widgets: [
          {
            id: "last-run-gen",
            type: "agent_last_run_generated",
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            config: { agentId: "a1" },
          },
          {
            id: "kpis",
            type: "kpi_cluster",
            x: 6,
            y: 0,
            w: 6,
            h: 4,
            config: { layout: "grid" },
          },
        ],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts compact single_kpi tiles for a 2x2 sidebar", () => {
    const result = validateDashboardLayout(
      {
        version: 1,
        widgets: [
          { id: "k1", type: "single_kpi", x: 8, y: 0, w: 2, h: 4, config: { metric: "projects" } },
          { id: "k2", type: "single_kpi", x: 10, y: 0, w: 2, h: 4, config: { metric: "running" } },
          { id: "k3", type: "single_kpi", x: 8, y: 4, w: 2, h: 4, config: { metric: "starting" } },
          { id: "k4", type: "single_kpi", x: 10, y: 4, w: 2, h: 4, config: { metric: "stopped_errors" } },
        ],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
  });
});
