import type { DashboardLayout } from "@/lib/dashboard/layout-schema";

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  widgets: [
    { id: "default-kpi-strip", type: "kpi_strip", x: 0, y: 0, w: 12, h: 2 },
    { id: "default-projects", type: "projects_showcase", x: 0, y: 2, w: 12, h: 5 },
    { id: "default-agents", type: "agents_showcase", x: 0, y: 6, w: 12, h: 5 },
    { id: "default-activity", type: "activity_log", x: 0, y: 11, w: 12, h: 5 },
  ],
};
