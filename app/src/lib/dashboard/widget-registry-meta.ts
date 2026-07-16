import { useMemo } from "react";

import { useTranslation } from "@/components/ui/locale-provider";
import type {
  WidgetRegistryMeta,
  WidgetSizeConstraints,
  WidgetSizePreset,
} from "@/lib/dashboard/layout-schema";

type WidgetRegistryMetaBase = Omit<
  WidgetRegistryMeta,
  "title" | "subtitle" | "description" | "categoryLabel"
> & {
  titleKey: string;
  subtitleKey: string;
  descriptionKey: string;
  categoryKey: string;
};

const KPI_TILE: WidgetSizeConstraints = { minW: 2, maxW: 6, minH: 2, maxH: 6 };
const KPI_TILE_PRESETS: WidgetSizePreset[] = [
  { id: "tile", labelKey: "widgets.sizePresets.tile", w: 3, h: 2 },
  { id: "sidebar", labelKey: "widgets.sizePresets.sidebar", w: 2, h: 4 },
  { id: "square", labelKey: "widgets.sizePresets.square", w: 3, h: 3 },
  { id: "wide", labelKey: "widgets.sizePresets.wide", w: 6, h: 2 },
];

const SHORTCUT: WidgetSizeConstraints = { minW: 2, maxW: 6, minH: 2, maxH: 4 };
const SHORTCUT_PRESETS: WidgetSizePreset[] = [
  { id: "tile", labelKey: "widgets.sizePresets.tile", w: 3, h: 2 },
  { id: "tall", labelKey: "widgets.sizePresets.tall", w: 3, h: 3 },
  { id: "wide", labelKey: "widgets.sizePresets.wide", w: 6, h: 2 },
];

export const WIDGET_REGISTRY_META_BASE: WidgetRegistryMetaBase[] = [
  {
    type: "kpi_strip",
    titleKey: "widgets.types.kpi_strip.title",
    subtitleKey: "widgets.types.kpi_strip.subtitle",
    descriptionKey: "widgets.types.kpi_strip.description",
    category: "overview",
    categoryKey: "widgets.categories.overview",
    keywords: ["kpi", "metrics", "overview", "stats", "running"],
    allowedSizes: [
      { w: 12, h: 2 },
      { w: 6, h: 4 },
      { w: 4, h: 6 },
    ],
    sizeConstraints: { minW: 4, maxW: 12, minH: 2, maxH: 6 },
    sizePresets: [
      { id: "strip", labelKey: "widgets.sizePresets.strip", w: 12, h: 2 },
      { id: "grid", labelKey: "widgets.sizePresets.grid2x2", w: 6, h: 4 },
      { id: "column", labelKey: "widgets.sizePresets.column", w: 4, h: 6 },
    ],
    maxInstances: 1,
    defaultSize: { w: 12, h: 2 },
  },
  {
    type: "kpi_cluster",
    titleKey: "widgets.types.kpi_cluster.title",
    subtitleKey: "widgets.types.kpi_cluster.subtitle",
    descriptionKey: "widgets.types.kpi_cluster.description",
    category: "overview",
    categoryKey: "widgets.categories.overview",
    keywords: ["kpi", "metrics", "overview", "stats", "cluster", "grid"],
    allowedSizes: [
      { w: 4, h: 8 },
      { w: 6, h: 4 },
      { w: 12, h: 2 },
    ],
    sizeConstraints: { minW: 4, maxW: 12, minH: 2, maxH: 8 },
    sizePresets: [
      { id: "sidebar", labelKey: "widgets.sizePresets.sidebar", w: 4, h: 8 },
      { id: "grid", labelKey: "widgets.sizePresets.grid2x2", w: 6, h: 4 },
      { id: "strip", labelKey: "widgets.sizePresets.strip", w: 12, h: 2 },
    ],
    maxInstances: 2,
    defaultSize: { w: 4, h: 8 },
    requiresConfig: true,
  },
  {
    type: "single_kpi",
    titleKey: "widgets.types.single_kpi.title",
    subtitleKey: "widgets.types.single_kpi.subtitle",
    descriptionKey: "widgets.types.single_kpi.description",
    category: "overview",
    categoryKey: "widgets.categories.overview",
    keywords: ["kpi", "metric", "number", "stat"],
    allowedSizes: [
      { w: 3, h: 2 },
      { w: 3, h: 3 },
      { w: 6, h: 2 },
    ],
    sizeConstraints: KPI_TILE,
    sizePresets: KPI_TILE_PRESETS,
    maxInstances: 8,
    defaultSize: { w: 3, h: 2 },
    requiresConfig: true,
  },
  {
    type: "projects_showcase",
    titleKey: "widgets.types.projects_showcase.title",
    subtitleKey: "widgets.types.projects_showcase.subtitle",
    descriptionKey: "widgets.types.projects_showcase.description",
    category: "projects",
    categoryKey: "widgets.categories.projects",
    keywords: ["projects", "workspace", "docker", "repos"],
    allowedSizes: [
      { w: 12, h: 5 },
      { w: 6, h: 5 },
    ],
    sizeConstraints: { minW: 6, maxW: 12, minH: 4, maxH: 8 },
    sizePresets: [
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 5 },
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 5 },
      { id: "tall", labelKey: "widgets.sizePresets.tallPanel", w: 12, h: 7 },
    ],
    maxInstances: 1,
    defaultSize: { w: 12, h: 5 },
  },
  {
    type: "agents_showcase",
    titleKey: "widgets.types.agents_showcase.title",
    subtitleKey: "widgets.types.agents_showcase.subtitle",
    descriptionKey: "widgets.types.agents_showcase.description",
    category: "agents",
    categoryKey: "widgets.categories.agents",
    keywords: ["agents", "ai", "automation", "cron"],
    allowedSizes: [
      { w: 12, h: 5 },
      { w: 6, h: 5 },
    ],
    sizeConstraints: { minW: 6, maxW: 12, minH: 4, maxH: 8 },
    sizePresets: [
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 5 },
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 5 },
      { id: "tall", labelKey: "widgets.sizePresets.tallPanel", w: 12, h: 7 },
    ],
    maxInstances: 1,
    defaultSize: { w: 12, h: 5 },
  },
  {
    type: "activity_log",
    titleKey: "widgets.types.activity_log.title",
    subtitleKey: "widgets.types.activity_log.subtitle",
    descriptionKey: "widgets.types.activity_log.description",
    category: "activity",
    categoryKey: "widgets.categories.activity",
    keywords: ["activity", "logs", "history", "events"],
    allowedSizes: [
      { w: 12, h: 5 },
      { w: 6, h: 5 },
    ],
    sizeConstraints: { minW: 6, maxW: 12, minH: 4, maxH: 8 },
    sizePresets: [
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 5 },
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 5 },
    ],
    maxInstances: 1,
    defaultSize: { w: 12, h: 5 },
  },
  {
    type: "activity_feed_compact",
    titleKey: "widgets.types.activity_feed_compact.title",
    subtitleKey: "widgets.types.activity_feed_compact.subtitle",
    descriptionKey: "widgets.types.activity_feed_compact.description",
    category: "activity",
    categoryKey: "widgets.categories.activity",
    keywords: ["activity", "feed", "events", "compact"],
    allowedSizes: [
      { w: 6, h: 4 },
      { w: 12, h: 4 },
    ],
    sizeConstraints: { minW: 4, maxW: 12, minH: 3, maxH: 8 },
    sizePresets: [
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 4 },
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 4 },
      { id: "tall", labelKey: "widgets.sizePresets.tallPanel", w: 6, h: 6 },
    ],
    maxInstances: 2,
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: "page_shortcut",
    titleKey: "widgets.types.page_shortcut.title",
    subtitleKey: "widgets.types.page_shortcut.subtitle",
    descriptionKey: "widgets.types.page_shortcut.description",
    category: "shortcuts",
    categoryKey: "widgets.categories.shortcuts",
    keywords: ["shortcut", "link", "navigate", "open"],
    allowedSizes: [
      { w: 3, h: 2 },
      { w: 6, h: 2 },
    ],
    sizeConstraints: SHORTCUT,
    sizePresets: SHORTCUT_PRESETS,
    maxInstances: 12,
    defaultSize: { w: 3, h: 2 },
    requiresConfig: true,
  },
  {
    type: "project_shortcut",
    titleKey: "widgets.types.project_shortcut.title",
    subtitleKey: "widgets.types.project_shortcut.subtitle",
    descriptionKey: "widgets.types.project_shortcut.description",
    category: "shortcuts",
    categoryKey: "widgets.categories.shortcuts",
    keywords: ["project", "workspace", "shortcut", "pin"],
    allowedSizes: [
      { w: 3, h: 2 },
      { w: 6, h: 3 },
    ],
    sizeConstraints: SHORTCUT,
    sizePresets: SHORTCUT_PRESETS,
    maxInstances: 8,
    defaultSize: { w: 3, h: 2 },
    requiresConfig: true,
  },
  {
    type: "agent_shortcut",
    titleKey: "widgets.types.agent_shortcut.title",
    subtitleKey: "widgets.types.agent_shortcut.subtitle",
    descriptionKey: "widgets.types.agent_shortcut.description",
    category: "agents",
    categoryKey: "widgets.categories.agents",
    keywords: ["agent", "card", "run", "shortcut", "pin", "ai"],
    allowedSizes: [
      { w: 4, h: 4 },
      { w: 6, h: 4 },
      { w: 8, h: 4 },
      { w: 12, h: 4 },
    ],
    sizeConstraints: { minW: 4, maxW: 12, minH: 3, maxH: 6 },
    sizePresets: [
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 4 },
      { id: "wide", labelKey: "widgets.sizePresets.wide", w: 8, h: 4 },
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 4 },
    ],
    maxInstances: 8,
    defaultSize: { w: 6, h: 4 },
    requiresConfig: true,
  },
  {
    type: "agent_last_run",
    titleKey: "widgets.types.agent_last_run.title",
    subtitleKey: "widgets.types.agent_last_run.subtitle",
    descriptionKey: "widgets.types.agent_last_run.description",
    category: "agents",
    categoryKey: "widgets.categories.agents",
    keywords: ["agent", "run", "last", "preview", "status", "output"],
    allowedSizes: [
      { w: 6, h: 4 },
      { w: 8, h: 8 },
      { w: 12, h: 4 },
    ],
    sizeConstraints: { minW: 4, maxW: 12, minH: 4, maxH: 10 },
    sizePresets: [
      { id: "half", labelKey: "widgets.sizePresets.half", w: 6, h: 6 },
      { id: "tall", labelKey: "widgets.sizePresets.tallPanel", w: 8, h: 8 },
      { id: "full", labelKey: "widgets.sizePresets.full", w: 12, h: 6 },
    ],
    maxInstances: 8,
    defaultSize: { w: 6, h: 6 },
    requiresConfig: true,
  },
  {
    type: "api_keys_summary",
    titleKey: "widgets.types.api_keys_summary.title",
    subtitleKey: "widgets.types.api_keys_summary.subtitle",
    descriptionKey: "widgets.types.api_keys_summary.description",
    category: "account",
    categoryKey: "widgets.categories.account",
    keywords: ["api", "keys", "token", "developer"],
    allowedSizes: [
      { w: 3, h: 2 },
      { w: 6, h: 2 },
    ],
    sizeConstraints: KPI_TILE,
    sizePresets: KPI_TILE_PRESETS,
    maxInstances: 1,
    defaultSize: { w: 3, h: 2 },
  },
];

export function useWidgetRegistryMeta(): WidgetRegistryMeta[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      WIDGET_REGISTRY_META_BASE.map((entry) => ({
        ...entry,
        title: t(entry.titleKey),
        subtitle: t(entry.subtitleKey),
        description: t(entry.descriptionKey),
        categoryLabel: t(entry.categoryKey),
      })),
    [t],
  );
}

export function useWidgetRegistryByType(): Record<string, WidgetRegistryMeta> {
  const meta = useWidgetRegistryMeta();
  return useMemo(
    () => Object.fromEntries(meta.map((entry) => [entry.type, entry])) as Record<string, WidgetRegistryMeta>,
    [meta],
  );
}

export const PAGE_SHORTCUT_OPTION_DEFS = [
  { route: "projects" as const, labelKey: "nav.projects", href: "/projects" },
  { route: "agents" as const, labelKey: "nav.agents", href: "/agents" },
  { route: "logs" as const, labelKey: "nav.logs", href: "/logs" },
  { route: "settings" as const, labelKey: "nav.settings", href: "/settings" },
  { route: "api_keys" as const, labelKey: "nav.apiKeys", href: "/settings/api-keys" },
  { route: "documentation" as const, labelKey: "nav.documentation", href: "/documentation" },
];

export function usePageShortcutOptions() {
  const { t } = useTranslation();
  return useMemo(
    () => PAGE_SHORTCUT_OPTION_DEFS.map((opt) => ({ ...opt, label: t(opt.labelKey) })),
    [t],
  );
}

export const KPI_METRIC_OPTION_DEFS = [
  { metric: "projects" as const, labelKey: "dashboard.kpiProjects" },
  { metric: "running" as const, labelKey: "dashboard.kpiRunning" },
  { metric: "starting" as const, labelKey: "dashboard.kpiStarting" },
  { metric: "stopped_errors" as const, labelKey: "dashboard.kpiStoppedErrors" },
];

export function useKpiMetricOptions() {
  const { t } = useTranslation();
  return useMemo(
    () => KPI_METRIC_OPTION_DEFS.map((opt) => ({ ...opt, label: t(opt.labelKey) })),
    [t],
  );
}

/** @deprecated Use useWidgetRegistryMeta() in React components */
export const WIDGET_REGISTRY_META: WidgetRegistryMeta[] = WIDGET_REGISTRY_META_BASE.map((entry) => ({
  ...entry,
  title: entry.titleKey,
  subtitle: entry.subtitleKey,
  description: entry.descriptionKey,
  categoryLabel: entry.categoryKey,
}));

export const WIDGET_REGISTRY_BY_TYPE = Object.fromEntries(
  WIDGET_REGISTRY_META.map((entry) => [entry.type, entry]),
) as Record<string, WidgetRegistryMeta>;

export const PAGE_SHORTCUT_OPTIONS = PAGE_SHORTCUT_OPTION_DEFS.map((opt) => ({
  ...opt,
  label: opt.labelKey,
}));

export const KPI_METRIC_OPTIONS = KPI_METRIC_OPTION_DEFS.map((opt) => ({
  ...opt,
  label: opt.labelKey,
}));

export const KPI_CLUSTER_LAYOUT_OPTIONS = [
  { layout: "grid" as const, labelKey: "widgets.kpiClusterLayout.grid" },
  { layout: "row" as const, labelKey: "widgets.kpiClusterLayout.row" },
  { layout: "column" as const, labelKey: "widgets.kpiClusterLayout.column" },
];

export function useKpiClusterLayoutOptions() {
  const { t } = useTranslation();
  return useMemo(
    () => KPI_CLUSTER_LAYOUT_OPTIONS.map((opt) => ({ ...opt, label: t(opt.labelKey) })),
    [t],
  );
}
