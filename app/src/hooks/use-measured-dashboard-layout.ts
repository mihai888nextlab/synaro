import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { rowsForContentHeight } from "@/lib/dashboard/grid-metrics";
import type { DashboardLayout, DashboardWidgetInstance } from "@/lib/dashboard/layout-schema";

type MeasuredHeights = Record<string, number>;

function applyMeasuredHeights(
  layout: DashboardLayout,
  measured: MeasuredHeights,
): DashboardLayout {
  if (Object.keys(measured).length === 0) return layout;
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => {
      const h = measured[widget.id];
      return h && h !== widget.h ? { ...widget, h } : widget;
    }),
  };
}

/** Measure widget DOM height and expand grid `h` so content is fully visible (no inner scroll). */
export function useMeasuredDashboardLayout(
  layout: DashboardLayout,
  editMode: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const [measured, setMeasured] = useState<MeasuredHeights>({});
  const measuredRef = useRef(measured);
  measuredRef.current = measured;
  const observers = useRef<Map<string, ResizeObserver>>(new Map());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    setMeasured({});
  }, [editMode]);

  const remeasure = useCallback(() => {
    if (!editMode) return;
    const root = containerRef.current;
    if (!root) return;

    const next: MeasuredHeights = {};
    const nodes = root.querySelectorAll<HTMLElement>("[data-dashboard-widget-measure]");

    nodes.forEach((node) => {
      const id = node.dataset.widgetId;
      if (!id) return;
      const contentHeight = node.scrollHeight;
      const rows = rowsForContentHeight(contentHeight);
      const widget = layoutRef.current.widgets.find((w) => w.id === id);
      if (!widget) return;
      const currentH = measuredRef.current[id] ?? widget.h;
      if (rows !== currentH) next[id] = rows;
    });

    setMeasured((prev) => {
      const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
      for (const key of keys) {
        if ((prev[key] ?? 0) !== (next[key] ?? 0)) {
          return { ...prev, ...next };
        }
      }
      return prev;
    });
  }, [containerRef, editMode]);

  useEffect(() => {
    if (!editMode) return;
    const root = containerRef.current;
    if (!root) return;

    const attach = () => {
      observers.current.forEach((observer) => observer.disconnect());
      observers.current.clear();

      root.querySelectorAll<HTMLElement>("[data-dashboard-widget-measure]").forEach((node) => {
        const id = node.dataset.widgetId;
        if (!id) return;
        const observer = new ResizeObserver(() => remeasure());
        observer.observe(node);
        observers.current.set(id, observer);
      });

      remeasure();
    };

    attach();
    const delayed = window.setTimeout(attach, 120);

    return () => {
      window.clearTimeout(delayed);
      observers.current.forEach((observer) => observer.disconnect());
      observers.current.clear();
    };
  }, [containerRef, layout.widgets, editMode, remeasure]);

  const displayLayout = useMemo(
    () => (editMode ? applyMeasuredHeights(layout, measured) : layout),
    [layout, measured, editMode],
  );

  return displayLayout;
}

export function mergeLayoutPositions(
  stored: DashboardWidgetInstance[],
  dragged: DashboardWidgetInstance[],
): DashboardWidgetInstance[] {
  const byId = new Map(dragged.map((widget) => [widget.id, widget]));
  return stored.map((widget) => {
    const item = byId.get(widget.id);
    if (!item) return widget;
    return { ...widget, x: item.x, y: item.y };
  });
}
