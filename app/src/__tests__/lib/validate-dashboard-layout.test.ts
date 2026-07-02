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
});
