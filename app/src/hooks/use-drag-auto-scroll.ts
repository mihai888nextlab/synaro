import { useCallback, useEffect, useRef } from "react";
import type { EventCallback } from "react-grid-layout";

const EDGE_PX = 80;
const SCROLL_STEP = 16;

function readPointerY(event: Event): number | null {
  if ("clientY" in event && typeof (event as MouseEvent).clientY === "number") {
    return (event as MouseEvent).clientY;
  }
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch?.clientY ?? null;
  }
  return null;
}

/** Auto-scroll the window while dragging near the viewport edges. */
export function useDragAutoScroll(active: boolean) {
  const pointerY = useRef(0);

  const trackPointer = useCallback((event: Event) => {
    const y = readPointerY(event);
    if (y !== null) pointerY.current = y;
  }, []);

  const onDrag: EventCallback = useCallback(
    (_layout, _oldItem, _newItem, _placeholder, event) => {
      trackPointer(event);
    },
    [trackPointer],
  );

  useEffect(() => {
    if (!active) return;

    const onMove = (event: MouseEvent | TouchEvent) => trackPointer(event);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    let frame: number | null = null;
    const tick = () => {
      const y = pointerY.current;
      if (y > 0 && y < EDGE_PX) {
        window.scrollBy({ top: -SCROLL_STEP, behavior: "auto" });
      } else if (y > window.innerHeight - EDGE_PX) {
        window.scrollBy({ top: SCROLL_STEP, behavior: "auto" });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [active, trackPointer]);

  return { onDrag };
}
