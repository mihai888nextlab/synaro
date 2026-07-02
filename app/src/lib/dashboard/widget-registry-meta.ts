import { useMemo } from "react";

import { useTranslation } from "@/components/ui/locale-provider";
import type { WidgetRegistryMeta } from "@/lib/dashboard/layout-schema";

type WidgetRegistryMetaBase = Omit<WidgetRegistryMeta, "title" | "subtitle" | "description" | "categoryLabel"> & {
  titleKey: string;
  subtitleKey: string;
  descriptionKey: string;
  categoryKey: string;
};

export const WIDGET_REGISTRY_META_BASE: WidgetRegistryMetaBase[] = [
  {
    type: "kpi_strip",
    titleKey: "widgets.types.kpi_strip.title",
    subtitleKey: "widgets.types.kpi_strip.subtitle",
    descriptionKey: "widgets.types.kpi_strip.description",
    category: "overview",
    categoryKey: "widgets.categories.overview",
    keywords: ["kpi", "metrics", "overview", "stats", "running"],
    allowedSizes: [{ w: 12, h: 2 }],
    maxInstances: 1,
    defaultSize: { w: 12, h: 2 },
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
      { w: 6, h: 2 },
    ],
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
    allowedSizes: [{ w: 12, h: 5 }],
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
    allowedSizes: [{ w: 12, h: 5 }],
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
    allowedSizes: [{ w: 12, h: 5 }],
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
    keywords: ["agent", "shortcut", "pin", "ai"],
    allowedSizes: [
      { w: 3, h: 2 },
      { w: 6, h: 3 },
    ],
    maxInstances: 8,
    defaultSize: { w: 3, h: 2 },
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
