import type { DashboardLayout, WidgetConfig, WidgetType } from "@/lib/dashboard/layout-schema";

export const WIDGET_DRAG_MIME = "application/x-synaro-dashboard-widget";

export type PendingWidgetDrag = {
  type: WidgetType;
  w: number;
  h: number;
  config?: WidgetConfig;
};

export function serializeWidgetDrag(payload: PendingWidgetDrag): string {
  return JSON.stringify(payload);
}

export function parseWidgetDrag(raw: string): PendingWidgetDrag | null {
  try {
    const data = JSON.parse(raw) as PendingWidgetDrag;
    if (typeof data.type !== "string" || typeof data.w !== "number" || typeof data.h !== "number") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function countWidgetInstances(layout: DashboardLayout, type: WidgetType): number {
  return layout.widgets.filter((widget) => widget.type === type).length;
}
