import { DASHBOARD_ROW_HEIGHT_PX } from "@/lib/dashboard/layout-schema";

export const DASHBOARD_GRID_MARGIN_X = 20;
export const DASHBOARD_GRID_MARGIN_Y = 20;
export const DASHBOARD_GRID_MARGIN: [number, number] = [
  DASHBOARD_GRID_MARGIN_X,
  DASHBOARD_GRID_MARGIN_Y,
];

/** Grid rows needed to fit `contentPx` without inner scrolling. */
export function rowsForContentHeight(
  contentPx: number,
  opts?: { rowHeight?: number; marginY?: number },
): number {
  const rowHeight = opts?.rowHeight ?? DASHBOARD_ROW_HEIGHT_PX;
  const marginY = opts?.marginY ?? DASHBOARD_GRID_MARGIN_Y;
  const total = Math.max(1, contentPx);
  return Math.max(1, Math.ceil((total + marginY) / (rowHeight + marginY)));
}
