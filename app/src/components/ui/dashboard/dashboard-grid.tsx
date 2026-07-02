"use client";

import { useCallback, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import GridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { X } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { DashboardWidgetRenderer } from "@/components/ui/dashboard/dashboard-widget-renderer";
import { useDragAutoScroll } from "@/hooks/use-drag-auto-scroll";
import {
  mergeLayoutPositions,
} from "@/hooks/use-measured-dashboard-layout";
import { DASHBOARD_GRID_MARGIN } from "@/lib/dashboard/grid-metrics";
import {
  createWidgetId,
  DASHBOARD_GRID_COLS,
  DASHBOARD_ROW_HEIGHT_PX,
  type DashboardLayout,
  type DashboardPageData,
  type DashboardWidgetInstance,
} from "@/lib/dashboard/layout-schema";
import {
  countWidgetInstances,
  parseWidgetDrag,
  type PendingWidgetDrag,
  WIDGET_DRAG_MIME,
} from "@/lib/dashboard/widget-drag";
import { WIDGET_REGISTRY_BY_TYPE } from "@/lib/dashboard/widget-registry-meta";
import { cn } from "@/lib/utils";

import "react-grid-layout/css/styles.css";

const DROPPING_ITEM_ID = "__dropping-elem__";

type DashboardGridProps = {
  layout: DashboardLayout;
  data: DashboardPageData;
  editMode: boolean;
  pendingWidgetDrag: PendingWidgetDrag | null;
  onPendingWidgetDragEnd: () => void;
  onLayoutChange: (layout: DashboardLayout) => void;
};

function toGridLayout(widgets: DashboardWidgetInstance[]): Layout {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    minW: widget.w,
    maxW: widget.w,
    minH: widget.h,
    maxH: widget.h,
    static: false,
  }));
}

function mergeGridLayout(
  widgets: DashboardWidgetInstance[],
  grid: Layout,
): DashboardWidgetInstance[] {
  const byId = new Map(grid.map((item) => [item.i, item]));
  return widgets.map((widget) => {
    const item = byId.get(widget.id);
    if (!item) return widget;
    return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
  });
}

export function DashboardGrid({
  layout,
  data,
  editMode,
  pendingWidgetDrag,
  onPendingWidgetDragEnd,
  onLayoutChange,
}: DashboardGridProps) {
  const { t } = useTranslation();
  const { width, containerRef, mounted } = useContainerWidth();
  const [dragging, setDragging] = useState(false);
  const { onDrag } = useDragAutoScroll(editMode && dragging);

  const gridLayout = useMemo(() => toGridLayout(layout.widgets), [layout.widgets]);

  const publishLayout = useCallback(
    (widgets: DashboardWidgetInstance[]) => {
      onLayoutChange({ ...layout, widgets });
    },
    [layout, onLayoutChange],
  );

  const handleDragStop = useCallback(
    (next: Layout) => {
      setDragging(false);
      const dragged = mergeGridLayout(layout.widgets, next);
      const withPositions = mergeLayoutPositions(layout.widgets, dragged);
      publishLayout(withPositions);
    },
    [layout.widgets, publishLayout],
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      publishLayout(layout.widgets.filter((widget) => widget.id !== widgetId));
    },
    [layout.widgets, publishLayout],
  );

  const resolvePendingDrag = useCallback(
    (event?: Event): PendingWidgetDrag | null => {
      if (pendingWidgetDrag) return pendingWidgetDrag;
      if (!(event instanceof DragEvent)) return null;
      const raw = event.dataTransfer?.getData(WIDGET_DRAG_MIME);
      return raw ? parseWidgetDrag(raw) : null;
    },
    [pendingWidgetDrag],
  );

  const handleDropDragOver = useCallback(
    (event: ReactDragEvent) => {
      if (!editMode) return false;
      if (!event.dataTransfer?.types.includes(WIDGET_DRAG_MIME) && !pendingWidgetDrag) {
        return false;
      }
      const payload = pendingWidgetDrag;
      if (!payload) return false;

      const meta = WIDGET_REGISTRY_BY_TYPE[payload.type];
      if (!meta || countWidgetInstances(layout, payload.type) >= meta.maxInstances) {
        return false;
      }

      return { w: payload.w, h: payload.h };
    },
    [editMode, layout, pendingWidgetDrag],
  );

  const handleDrop = useCallback(
    (_grid: Layout, item: LayoutItem | undefined, event: Event) => {
      const payload = resolvePendingDrag(event);
      onPendingWidgetDragEnd();

      if (!payload || !item) return;

      const meta = WIDGET_REGISTRY_BY_TYPE[payload.type];
      if (!meta || countWidgetInstances(layout, payload.type) >= meta.maxInstances) return;

      const newWidget: DashboardWidgetInstance = {
        id: createWidgetId(),
        type: payload.type,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        config: payload.config,
      };

      publishLayout([...layout.widgets, newWidget]);
    },
    [layout, onPendingWidgetDragEnd, publishLayout, resolvePendingDrag],
  );

  const droppingItem = useMemo<LayoutItem>(
    () => ({
      i: DROPPING_ITEM_ID,
      x: 0,
      y: 0,
      w: pendingWidgetDrag?.w ?? 1,
      h: pendingWidgetDrag?.h ?? 1,
    }),
    [pendingWidgetDrag],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "dashboard-grid-root min-w-0",
        editMode && pendingWidgetDrag && "dashboard-grid-root--drop-target",
      )}
    >
      {mounted ? (
        <GridLayout
          className={cn("dashboard-grid", editMode && "dashboard-grid--editing")}
          width={width}
          layout={gridLayout}
          autoSize
          droppingItem={droppingItem}
          gridConfig={{
            cols: DASHBOARD_GRID_COLS,
            rowHeight: DASHBOARD_ROW_HEIGHT_PX,
            margin: DASHBOARD_GRID_MARGIN,
            containerPadding: [0, 0],
          }}
          dragConfig={{
            enabled: editMode,
            cancel: ".dashboard-widget-no-drag",
          }}
          dropConfig={{ enabled: editMode }}
          resizeConfig={{ enabled: false }}
          compactor={verticalCompactor}
          onDragStart={() => setDragging(true)}
          onDrag={onDrag}
          onDragStop={handleDragStop}
          onDropDragOver={handleDropDragOver}
          onDrop={handleDrop}
        >
          {layout.widgets.map((widget) => (
            <div
              key={widget.id}
              className={cn(
                "dashboard-grid-item group/item relative h-full",
                editMode && "dashboard-grid-item--editing",
              )}
            >
              {editMode ? (
                <button
                  type="button"
                  onClick={() => removeWidget(widget.id)}
                  className="dashboard-widget-no-drag absolute right-3 top-3 z-20 inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("dashboard.removeWidget")}
                >
                  <X className="size-4" />
                </button>
              ) : null}
              <div
                className={cn(
                  "dashboard-grid-item__content h-full overflow-visible",
                  editMode && "pointer-events-none select-none",
                )}
                {...(editMode ? { inert: true } : {})}
              >
                <DashboardWidgetRenderer variant="live" layoutMode="grid" widget={widget} data={data} />
              </div>
            </div>
          ))}
        </GridLayout>
      ) : null}
    </div>
  );
}
