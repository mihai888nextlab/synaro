import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import type { DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import type { SynaroAgentCardModel } from "@/components/ui/agent-cards-grid";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";

export const DASHBOARD_LAYOUT_VERSION = 1;
export const DASHBOARD_GRID_COLS = 12;
export const DASHBOARD_ROW_HEIGHT_PX = 80;

export const WIDGET_TYPES = [
  "kpi_strip",
  "kpi_cluster",
  "single_kpi",
  "projects_showcase",
  "agents_showcase",
  "activity_log",
  "activity_feed_compact",
  "page_shortcut",
  "project_shortcut",
  "agent_shortcut",
  "agent_last_run",
  "api_keys_summary",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export type KpiMetricKey = "projects" | "running" | "starting" | "stopped_errors";

export type PageShortcutRoute =
  | "projects"
  | "agents"
  | "logs"
  | "settings"
  | "api_keys"
  | "documentation";

export type KpiClusterLayoutMode = "row" | "grid" | "column";

export type WidgetConfig =
  | { metric: KpiMetricKey }
  | { route: PageShortcutRoute }
  | { projectId: string }
  | { agentId: string }
  | { layout: KpiClusterLayoutMode };

export type WidgetSizeConstraints = {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
};

export type WidgetSizePreset = {
  id: string;
  labelKey: string;
  w: number;
  h: number;
};

export type DashboardWidgetInstance = {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: WidgetConfig;
};

export type DashboardLayout = {
  version: typeof DASHBOARD_LAYOUT_VERSION;
  widgets: DashboardWidgetInstance[];
};

export type DashboardPageData = {
  projects: SynaroProjectCardModel[];
  agents: SynaroAgentCardModel[];
  kpiItems: DashboardKpiItem[];
  activityLogs: DashboardLogRow[];
  apiKeysCount: number;
};

export type WidgetSize = { w: number; h: number };

export type WidgetCategory =
  | "overview"
  | "projects"
  | "agents"
  | "activity"
  | "shortcuts"
  | "account";

export type WidgetRegistryMeta = {
  type: WidgetType;
  title: string;
  subtitle: string;
  description: string;
  category: WidgetCategory;
  categoryLabel: string;
  keywords: string[];
  allowedSizes: WidgetSize[];
  sizeConstraints: WidgetSizeConstraints;
  sizePresets: WidgetSizePreset[];
  maxInstances: number;
  defaultSize: WidgetSize;
  requiresConfig?: boolean;
};

export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

export function createWidgetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
