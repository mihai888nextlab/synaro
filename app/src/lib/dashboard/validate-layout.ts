import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/default-layout";
import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_LAYOUT_VERSION,
  type DashboardLayout,
  type DashboardWidgetInstance,
  isWidgetType,
} from "@/lib/dashboard/layout-schema";
import { WIDGET_REGISTRY_BY_TYPE } from "@/lib/dashboard/widget-registry-meta";
import { clampWidgetSize, isWidgetSizeValid } from "@/lib/dashboard/widget-size-utils";

export type LayoutValidationContext = {
  projectIds: Set<string>;
  agentIds: Set<string>;
  /** When true, skip agent ownership checks (agent-service unreachable). */
  skipAgentOwnershipCheck?: boolean;
};

export type LayoutValidationResult =
  | { ok: true; layout: DashboardLayout }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWidget(raw: unknown): DashboardWidgetInstance | null {
  if (!isRecord(raw)) return null;
  const { id, type, x, y, w, h, config } = raw;
  if (typeof id !== "string" || !id.trim()) return null;
  if (typeof type !== "string" || !isWidgetType(type)) return null;
  if (typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number") {
    return null;
  }
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  const widget: DashboardWidgetInstance = {
    id: id.trim(),
    type,
    x: Math.floor(x),
    y: Math.floor(y),
    w: Math.floor(w),
    h: Math.floor(h),
  };
  if (config !== undefined) {
    if (!isRecord(config)) return null;
    widget.config = config as DashboardWidgetInstance["config"];
  }
  return widget;
}

function sizeAllowed(
  type: DashboardWidgetInstance["type"],
  w: number,
  h: number,
): boolean {
  return isWidgetSizeValid(type, w, h);
}

function normalizeWidgetGeometry(widget: DashboardWidgetInstance): DashboardWidgetInstance {
  const clamped = clampWidgetSize(widget.type, widget.w, widget.h, widget.x);
  return {
    ...widget,
    x: clamped.x,
    w: clamped.w,
    h: clamped.h,
  };
}

function validateWidgetConfig(
  widget: DashboardWidgetInstance,
  ctx: LayoutValidationContext,
): string | null {
  const meta = WIDGET_REGISTRY_BY_TYPE[widget.type];
  if (!meta) return `Unknown widget type: ${widget.type}`;

  if (widget.type === "single_kpi") {
    const metric = (widget.config as { metric?: string } | undefined)?.metric;
    if (!metric || !["projects", "running", "starting", "stopped_errors"].includes(metric)) {
      return "single_kpi requires a valid metric config";
    }
    return null;
  }

  if (widget.type === "page_shortcut") {
    const route = (widget.config as { route?: string } | undefined)?.route;
    const valid = ["projects", "agents", "logs", "settings", "api_keys", "documentation"];
    if (!route || !valid.includes(route)) {
      return "page_shortcut requires a valid route config";
    }
    return null;
  }

  if (widget.type === "project_shortcut") {
    const projectId = (widget.config as { projectId?: string } | undefined)?.projectId;
    if (!projectId || !ctx.projectIds.has(projectId)) {
      return "project_shortcut requires a project you can access";
    }
    return null;
  }

  if (widget.type === "agent_shortcut") {
    const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
    if (!agentId) return "agent_shortcut requires a valid agent";
    if (!ctx.skipAgentOwnershipCheck && !ctx.agentIds.has(agentId)) {
      return "agent_shortcut requires a valid agent";
    }
    return null;
  }

  if (widget.type === "agent_last_run") {
    const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
    if (!agentId) return "agent_last_run requires a valid agent";
    if (!ctx.skipAgentOwnershipCheck && !ctx.agentIds.has(agentId)) {
      return "agent_last_run requires a valid agent";
    }
    return null;
  }

  if (widget.type === "agent_last_run_generated") {
    const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
    if (!agentId) return "agent_last_run_generated requires a valid agent";
    if (!ctx.skipAgentOwnershipCheck && !ctx.agentIds.has(agentId)) {
      return "agent_last_run_generated requires a valid agent";
    }
    return null;
  }

  if (widget.type === "kpi_cluster") {
    const layout = (widget.config as { layout?: string } | undefined)?.layout;
    if (layout && !["row", "grid", "column"].includes(layout)) {
      return "kpi_cluster layout must be row, grid, or column";
    }
    return null;
  }

  if (meta.requiresConfig && widget.config === undefined) {
    return `${widget.type} requires configuration`;
  }

  return null;
}

export function parseDashboardLayout(raw: unknown): DashboardLayout | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== DASHBOARD_LAYOUT_VERSION) return null;
  if (!Array.isArray(raw.widgets)) return null;

  const widgets: DashboardWidgetInstance[] = [];
  for (const item of raw.widgets) {
    const parsed = parseWidget(item);
    if (!parsed) return null;
    widgets.push(parsed);
  }

  return { version: DASHBOARD_LAYOUT_VERSION, widgets };
}

export function validateDashboardLayout(
  layout: DashboardLayout,
  ctx: LayoutValidationContext,
): LayoutValidationResult {
  if (layout.version !== DASHBOARD_LAYOUT_VERSION) {
    return { ok: false, error: "Unsupported layout version" };
  }

  const ids = new Set<string>();
  const typeCounts = new Map<string, number>();

  for (const widget of layout.widgets) {
    if (ids.has(widget.id)) {
      return { ok: false, error: "Duplicate widget id" };
    }
    ids.add(widget.id);

    const meta = WIDGET_REGISTRY_BY_TYPE[widget.type];
    if (!meta) {
      return { ok: false, error: `Unknown widget type: ${widget.type}` };
    }

    if (widget.x < 0 || widget.y < 0 || widget.w < 1 || widget.h < 1) {
      return { ok: false, error: "Invalid widget geometry" };
    }
    if (widget.x + widget.w > DASHBOARD_GRID_COLS) {
      return { ok: false, error: "Widget extends past grid columns" };
    }
    if (!sizeAllowed(widget.type, widget.w, widget.h)) {
      return { ok: false, error: `Invalid size for ${widget.type}` };
    }

    const configError = validateWidgetConfig(widget, ctx);
    if (configError) {
      return { ok: false, error: configError };
    }

    typeCounts.set(widget.type, (typeCounts.get(widget.type) ?? 0) + 1);
    if ((typeCounts.get(widget.type) ?? 0) > meta.maxInstances) {
      return { ok: false, error: `Too many instances of ${widget.type}` };
    }
  }

  return { ok: true, layout: { ...layout, widgets: layout.widgets.map(normalizeWidgetGeometry) } };
}

export function resolveDashboardLayout(stored: unknown): DashboardLayout {
  const parsed = parseDashboardLayout(stored);
  if (!parsed) return DEFAULT_DASHBOARD_LAYOUT;
  const result = validateDashboardLayout(parsed, {
    projectIds: new Set(),
    agentIds: new Set(),
  });
  if (!result.ok) return DEFAULT_DASHBOARD_LAYOUT;
  return result.layout;
}

export function compactLayoutRows(widgets: DashboardWidgetInstance[]): DashboardWidgetInstance[] {
  if (widgets.length === 0) return [];
  const sorted = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  let cursorY = 0;
  return sorted.map((widget) => {
    const next = { ...widget, y: cursorY };
    cursorY += widget.h;
    return next;
  });
}

export function appendWidget(
  layout: DashboardLayout,
  widget: Omit<DashboardWidgetInstance, "x" | "y"> & { x?: number; y?: number },
): DashboardLayout {
  const maxY = layout.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  return {
    ...layout,
    widgets: [
      ...layout.widgets,
      {
        ...widget,
        x: widget.x ?? 0,
        y: widget.y ?? maxY,
      },
    ],
  };
}
