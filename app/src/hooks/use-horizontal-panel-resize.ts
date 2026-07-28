"use client";

import * as React from "react";

import {
  clampPreviewPanelWidthPx,
  defaultPreviewPanelWidthPx,
  readPreviewPanelWidthPx,
  writePreviewPanelWidthPx,
} from "@/lib/dashboard-workflow-storage";

type UseHorizontalPanelResizeArgs = {
  projectId?: string;
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Left-edge drag resize for a right-hand panel (e.g. project Preview).
 * Dragging the handle left widens the panel; right narrows it.
 */
export function useHorizontalPanelResize({
  projectId,
  enabled,
  containerRef,
}: UseHorizontalPanelResizeArgs) {
  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const widthRef = React.useRef<number | null>(null);
  const containerWidthRef = React.useRef(0);
  const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  React.useEffect(() => {
    widthRef.current = widthPx;
  }, [widthPx]);

  React.useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    let hydrated = false;
    const projectKey = projectId?.trim() || "";

    const apply = (containerWidth: number) => {
      if (containerWidth < 1) return;
      containerWidthRef.current = containerWidth;
      setWidthPx((prev) => {
        if (!hydrated) {
          hydrated = true;
          const stored = projectKey ? readPreviewPanelWidthPx(projectKey) : null;
          if (stored != null) {
            return clampPreviewPanelWidthPx(stored, containerWidth);
          }
          return defaultPreviewPanelWidthPx(containerWidth);
        }
        if (prev == null) {
          return defaultPreviewPanelWidthPx(containerWidth);
        }
        return clampPreviewPanelWidthPx(prev, containerWidth);
      });
    };

    apply(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
      apply(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, enabled, projectId]);

  const onHandlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || widthRef.current == null) return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      dragRef.current = { startX: event.clientX, startWidth: widthRef.current };
      setIsDragging(true);
      handle.setPointerCapture(event.pointerId);

      const previousUserSelect = document.body.style.userSelect;
      const previousCursor = document.body.style.cursor;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const deltaX = moveEvent.clientX - drag.startX;
        const next = clampPreviewPanelWidthPx(
          drag.startWidth - deltaX,
          containerWidthRef.current,
        );
        setWidthPx(next);
      };

      const finish = (upEvent: PointerEvent) => {
        dragRef.current = null;
        setIsDragging(false);
        document.body.style.userSelect = previousUserSelect;
        document.body.style.cursor = previousCursor;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        try {
          if (handle.hasPointerCapture(upEvent.pointerId)) {
            handle.releasePointerCapture(upEvent.pointerId);
          }
        } catch {
          /* already released */
        }
        const finalWidth = widthRef.current;
        if (projectId?.trim() && finalWidth != null) {
          writePreviewPanelWidthPx(projectId.trim(), finalWidth);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [enabled, projectId],
  );

  return {
    widthPx,
    isDragging,
    onHandlePointerDown,
  };
}
