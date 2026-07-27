import {
  clampWidgetSize,
  getWidgetDensity,
  isWidgetSizeValid,
  kpiLayoutGridClass,
  resolveKpiLayoutMode,
} from "@/lib/dashboard/widget-size-utils";

describe("widget-size-utils", () => {
  it("validates sizes within constraints", () => {
    expect(isWidgetSizeValid("single_kpi", 3, 2)).toBe(true);
    expect(isWidgetSizeValid("single_kpi", 1, 2)).toBe(false);
    expect(isWidgetSizeValid("agent_last_run_generated", 8, 8)).toBe(true);
    expect(isWidgetSizeValid("agent_last_run_generated", 3, 3)).toBe(false);
  });

  it("clamps width to grid columns", () => {
    expect(clampWidgetSize("single_kpi", 8, 2, 10)).toEqual({ w: 2, h: 2, x: 10 });
  });

  it("derives widget density from footprint", () => {
    expect(getWidgetDensity(2, 2)).toBe("compact");
    expect(getWidgetDensity(4, 3)).toBe("normal");
    expect(getWidgetDensity(8, 8)).toBe("expanded");
  });

  it("resolves KPI layout modes from dimensions", () => {
    expect(resolveKpiLayoutMode(12, 2)).toBe("row");
    expect(resolveKpiLayoutMode(6, 4)).toBe("grid");
    expect(resolveKpiLayoutMode(4, 8)).toBe("column");
    expect(resolveKpiLayoutMode(6, 4, "row")).toBe("row");
  });

  it("maps KPI layout modes to grid classes", () => {
    expect(kpiLayoutGridClass("grid")).toContain("grid-cols-2");
    expect(kpiLayoutGridClass("column")).toContain("grid-cols-1");
  });
});
