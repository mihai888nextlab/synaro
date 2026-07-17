import type { WidgetSizeConstraints, WidgetType } from "@/lib/dashboard/layout-schema";
import { DASHBOARD_GRID_COLS } from "@/lib/dashboard/layout-schema";
import { WIDGET_REGISTRY_BY_TYPE } from "@/lib/dashboard/widget-registry-meta";

export type WidgetDensity = "compact" | "normal" | "expanded";

export type KpiClusterLayoutMode = "row" | "grid" | "column";

export function getWidgetSizeConstraints(type: WidgetType): WidgetSizeConstraints {
  return (
    WIDGET_REGISTRY_BY_TYPE[type]?.sizeConstraints ?? {
      minW: 2,
      maxW: DASHBOARD_GRID_COLS,
      minH: 2,
      maxH: 12,
    }
  );
}

export function isWidgetSizeValid(type: WidgetType, w: number, h: number): boolean {
  const c = getWidgetSizeConstraints(type);
  return (
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w >= c.minW &&
    w <= c.maxW &&
    h >= c.minH &&
    h <= c.maxH
  );
}

export function clampWidgetSize(
  type: WidgetType,
  w: number,
  h: number,
  x = 0,
): { w: number; h: number; x: number } {
  const c = getWidgetSizeConstraints(type);
  let nextW = Math.max(c.minW, Math.min(c.maxW, Math.floor(w)));
  const nextH = Math.max(c.minH, Math.min(c.maxH, Math.floor(h)));
  let nextX = Math.floor(x);

  if (nextX + nextW > DASHBOARD_GRID_COLS) {
    nextW = DASHBOARD_GRID_COLS - nextX;
  }
  if (nextW < c.minW) {
    nextW = c.minW;
    nextX = Math.max(0, DASHBOARD_GRID_COLS - nextW);
  }

  return { w: nextW, h: nextH, x: nextX };
}

export function getWidgetDensity(w: number, h: number): WidgetDensity {
  const area = w * h;
  if (area <= 6 || (w <= 2 && h <= 2)) return "compact";
  if (area >= 24 || h >= 6) return "expanded";
  return "normal";
}

/** Auto layout for KPI strip / cluster based on grid footprint. */
export function resolveKpiLayoutMode(
  w: number,
  h: number,
  preferred?: KpiClusterLayoutMode,
): KpiClusterLayoutMode {
  if (preferred) return preferred;
  if (h >= 5 && w <= 4) return "column";
  if (h >= 4 && w <= 8) return "grid";
  if (h <= 3 && w >= 8) return "row";
  if (w >= 6 && h >= 4) return "grid";
  return "row";
}

export function kpiLayoutGridClass(mode: KpiClusterLayoutMode): string {
  switch (mode) {
    case "grid":
      return "grid h-full grid-cols-2 grid-rows-2 gap-3 sm:gap-4";
    case "column":
      return "grid h-full grid-cols-1 gap-3 sm:gap-4";
    default:
      return "grid h-full grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4";
  }
}
