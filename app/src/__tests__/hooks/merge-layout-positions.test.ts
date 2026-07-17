import { mergeLayoutPositions } from "@/hooks/use-measured-dashboard-layout";
import type { DashboardWidgetInstance } from "@/lib/dashboard/layout-schema";

describe("mergeLayoutPositions", () => {
  it("preserves resized width and height along with position", () => {
    const stored: DashboardWidgetInstance[] = [
      { id: "w1", type: "single_kpi", x: 0, y: 0, w: 3, h: 2, config: { metric: "projects" } },
      { id: "w2", type: "kpi_strip", x: 0, y: 2, w: 12, h: 2 },
    ];
    const dragged: DashboardWidgetInstance[] = [
      { id: "w1", type: "single_kpi", x: 6, y: 1, w: 6, h: 4, config: { metric: "projects" } },
      { id: "w2", type: "kpi_strip", x: 0, y: 5, w: 12, h: 2 },
    ];

    expect(mergeLayoutPositions(stored, dragged)).toEqual([
      { id: "w1", type: "single_kpi", x: 6, y: 1, w: 6, h: 4, config: { metric: "projects" } },
      { id: "w2", type: "kpi_strip", x: 0, y: 5, w: 12, h: 2 },
    ]);
  });
});
