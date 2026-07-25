"use client";

import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { DashboardWidgetRenderer } from "@/components/ui/dashboard/dashboard-widget-renderer";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useKpiMetricOptions,
  useKpiClusterLayoutOptions,
  usePageShortcutOptions,
  useWidgetRegistryMeta,
} from "@/lib/dashboard/widget-registry-meta";
import { useTranslation } from "@/components/ui/locale-provider";
import {
  type DashboardLayout,
  type DashboardPageData,
  type WidgetConfig,
  type WidgetRegistryMeta,
  type WidgetType,
  createWidgetId,
} from "@/lib/dashboard/layout-schema";
import {
  countWidgetInstances,
  type PendingWidgetDrag,
  serializeWidgetDrag,
  WIDGET_DRAG_MIME,
} from "@/lib/dashboard/widget-drag";
import { appendWidget } from "@/lib/dashboard/validate-layout";
import { cn } from "@/lib/utils";

type DashboardWidgetPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
  data: DashboardPageData;
  onPendingWidgetDragStart: (drag: PendingWidgetDrag | null) => void;
  onPendingWidgetDragEnd: () => void;
  onAdd: (layout: DashboardLayout) => void;
};

type ConfigStep = {
  meta: WidgetRegistryMeta;
};

class PickerPreviewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 text-[10px] text-muted-foreground">
          Preview
        </div>
      );
    }
    return this.props.children;
  }
}

function countInstances(layout: DashboardLayout, type: WidgetType): number {
  return countWidgetInstances(layout, type);
}

function buildPendingDrag(
  meta: WidgetRegistryMeta,
  data: DashboardPageData,
): PendingWidgetDrag {
  return {
    type: meta.type,
    w: meta.defaultSize.w,
    h: meta.defaultSize.h,
    config: defaultConfig(meta, data),
  };
}

function defaultConfig(meta: WidgetRegistryMeta, data: DashboardPageData): WidgetConfig | undefined {
  if (meta.type === "single_kpi") return { metric: "projects" };
  if (meta.type === "kpi_cluster") return { layout: "grid" };
  if (meta.type === "page_shortcut") return { route: "projects" };
  if (meta.type === "project_shortcut" && data.projects[0]) {
    return { projectId: data.projects[0].id };
  }
  if (meta.type === "agent_shortcut" && data.agents[0]) {
    return { agentId: data.agents[0].id };
  }
  if (meta.type === "agent_last_run" && data.agents[0]) {
    return { agentId: data.agents[0].id };
  }
  if (meta.type === "agent_last_run_generated" && data.agents[0]) {
    return { agentId: data.agents[0].id };
  }
  return undefined;
}

export function DashboardWidgetPicker({
  open,
  onOpenChange,
  layout,
  data,
  onPendingWidgetDragStart,
  onPendingWidgetDragEnd,
  onAdd,
}: DashboardWidgetPickerProps) {
  const { t } = useTranslation();
  const widgetRegistryMeta = useWidgetRegistryMeta();
  const kpiMetricOptions = useKpiMetricOptions();
  const kpiClusterLayoutOptions = useKpiClusterLayoutOptions();
  const pageShortcutOptions = usePageShortcutOptions();
  const [query, setQuery] = useState("");
  const [configStep, setConfigStep] = useState<ConfigStep | null>(null);
  const [draftConfig, setDraftConfig] = useState<WidgetConfig | undefined>();
  const [draggingFromPicker, setDraggingFromPicker] = useState(false);
  const suppressClickRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return widgetRegistryMeta;
    return widgetRegistryMeta.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.keywords.some((keyword) => keyword.includes(q)) ||
        entry.categoryLabel.toLowerCase().includes(q),
    );
  }, [query, widgetRegistryMeta]);

  const grouped = useMemo(() => {
    const map = new Map<string, WidgetRegistryMeta[]>();
    for (const entry of filtered) {
      const list = map.get(entry.categoryLabel) ?? [];
      list.push(entry);
      map.set(entry.categoryLabel, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const close = () => {
    setConfigStep(null);
    setDraftConfig(undefined);
    setQuery("");
    setDraggingFromPicker(false);
    onPendingWidgetDragEnd();
    onOpenChange(false);
  };

  const startPickerDrag = (meta: WidgetRegistryMeta, event: React.DragEvent<HTMLElement>) => {
    if (countInstances(layout, meta.type) >= meta.maxInstances) {
      event.preventDefault();
      return;
    }

    const payload = buildPendingDrag(meta, data);
    suppressClickRef.current = true;
    setDraggingFromPicker(true);
    onPendingWidgetDragStart(payload);
    event.dataTransfer.setData(WIDGET_DRAG_MIME, serializeWidgetDrag(payload));
    event.dataTransfer.effectAllowed = "copy";
  };

  const endPickerDrag = () => {
    setDraggingFromPicker(false);
    onPendingWidgetDragEnd();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const addWidget = (meta: WidgetRegistryMeta, config?: WidgetConfig) => {
    const next = appendWidget(layout, {
      id: createWidgetId(),
      type: meta.type,
      w: meta.defaultSize.w,
      h: meta.defaultSize.h,
      config,
    });
    onAdd(next);
    close();
  };

  const handlePick = (meta: WidgetRegistryMeta) => {
    if (countInstances(layout, meta.type) >= meta.maxInstances) return;

    if (meta.requiresConfig) {
      setConfigStep({ meta });
      setDraftConfig(defaultConfig(meta, data));
      return;
    }

    addWidget(meta);
  };

  const confirmConfig = () => {
    if (!configStep) return;
    addWidget(configStep.meta, draftConfig);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        overlayClassName={cn(
          draggingFromPicker && "pointer-events-none bg-black/20",
        )}
        className={cn(
          "fixed inset-x-0 bottom-0 top-auto z-[9999] flex max-h-[min(88vh,820px)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-t-3xl border border-border/70 bg-background p-0 shadow-2xl",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:left-1/2 sm:w-[min(100vw-2rem,42rem)] sm:-translate-x-1/2",
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />

        {configStep ? (
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <DialogTitle className="text-lg font-semibold">
              {t("widgets.configureTitle", { title: configStep.meta.title })}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{configStep.meta.description}</p>

            {configStep.meta.type === "single_kpi" ? (
              <div className="grid gap-2">
                {kpiMetricOptions.map((option) => (
                  <button
                    key={option.metric}
                    type="button"
                    onClick={() => setDraftConfig({ metric: option.metric })}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left text-sm transition",
                      (draftConfig as { metric?: string } | undefined)?.metric === option.metric
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:bg-muted/40",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {configStep.meta.type === "kpi_cluster" ? (
              <div className="grid grid-cols-3 gap-2">
                {kpiClusterLayoutOptions.map((option) => (
                  <button
                    key={option.layout}
                    type="button"
                    onClick={() => setDraftConfig({ layout: option.layout })}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-center text-sm transition",
                      (draftConfig as { layout?: string } | undefined)?.layout === option.layout
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:bg-muted/40",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {configStep.meta.type === "page_shortcut" ? (
              <div className="grid grid-cols-2 gap-2">
                {pageShortcutOptions.map((option) => (
                  <button
                    key={option.route}
                    type="button"
                    onClick={() => setDraftConfig({ route: option.route })}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm transition",
                      (draftConfig as { route?: string } | undefined)?.route === option.route
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:bg-muted/40",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {configStep.meta.type === "project_shortcut" ? (
              <div className="grid max-h-56 gap-2 overflow-auto">
                {data.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("widgets.createProjectFirst")}</p>
                ) : (
                  data.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setDraftConfig({ projectId: project.id })}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        (draftConfig as { projectId?: string } | undefined)?.projectId === project.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-muted/40",
                      )}
                    >
                      {project.title}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {configStep.meta.type === "agent_shortcut" ? (
              <div className="grid max-h-56 gap-2 overflow-auto">
                {data.agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("widgets.createAgentFirst")}</p>
                ) : (
                  data.agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setDraftConfig({ agentId: agent.id })}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        (draftConfig as { agentId?: string } | undefined)?.agentId === agent.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-muted/40",
                      )}
                    >
                      {agent.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {configStep.meta.type === "agent_last_run" ||
            configStep.meta.type === "agent_last_run_generated" ? (
              <div className="grid max-h-56 gap-2 overflow-auto">
                {data.agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("widgets.createAgentFirst")}</p>
                ) : (
                  data.agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setDraftConfig({ agentId: agent.id })}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left text-sm transition",
                        (draftConfig as { agentId?: string } | undefined)?.agentId === agent.id
                          ? "border-primary bg-primary/5"
                          : "border-border/70 hover:bg-muted/40",
                      )}
                    >
                      {agent.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfigStep(null)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("onboarding.back")}
              </button>
              <button
                type="button"
                onClick={confirmConfig}
                disabled={
                  (configStep.meta.type === "project_shortcut" && data.projects.length === 0) ||
                  (configStep.meta.type === "agent_shortcut" && data.agents.length === 0) ||
                  ((configStep.meta.type === "agent_last_run" ||
                    configStep.meta.type === "agent_last_run_generated") &&
                    data.agents.length === 0)
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {t("dashboard.addWidget")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-border/50 px-5 py-4 sm:px-6">
              <DialogTitle className="text-lg font-semibold">{t("dashboard.addWidget")}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t("widgets.addWidgetsHint")}</p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("widgets.searchWidgets")}
                  className="h-10 w-full rounded-xl border border-border/70 bg-muted/20 py-2 pl-10 pr-3 text-sm focus:border-border focus:outline-none focus:ring-1 focus:ring-ring/40"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {grouped.map(([category, entries]) => (
                <section key={category} className="mb-6 last:mb-0">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {entries.map((entry) => {
                      const atMax = countInstances(layout, entry.type) >= entry.maxInstances;
                      const previewWidget = {
                        id: `preview-${entry.type}`,
                        type: entry.type,
                        x: 0,
                        y: 0,
                        w: entry.defaultSize.w,
                        h: entry.defaultSize.h,
                        config: defaultConfig(entry, data),
                      };

                      return (
                        <div
                          key={entry.type}
                          role="button"
                          tabIndex={atMax ? -1 : 0}
                          draggable={!atMax}
                          onDragStart={(event) => startPickerDrag(entry, event)}
                          onDragEnd={endPickerDrag}
                          onClick={() => {
                            if (suppressClickRef.current || atMax) return;
                            handlePick(entry);
                          }}
                          onKeyDown={(event) => {
                            if (atMax) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handlePick(entry);
                            }
                          }}
                          className={cn(
                            "flex flex-col overflow-hidden rounded-2xl border text-left transition",
                            atMax
                              ? "cursor-not-allowed border-border/40 opacity-60"
                              : "cursor-grab border-border/70 hover:border-border hover:bg-muted/20 active:cursor-grabbing",
                          )}
                        >
                          <div className="pointer-events-none h-28 overflow-hidden bg-muted/15 p-2">
                            <div className="origin-top-left scale-[0.45]">
                              <div style={{ width: 280, height: 160 }}>
                                <PickerPreviewBoundary>
                                  <DashboardWidgetRenderer
                                    variant="preview"
                                    widget={previewWidget}
                                    data={data}
                                  />
                                </PickerPreviewBoundary>
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-border/50 px-3 py-2.5">
                            <p className="text-sm font-medium text-foreground">{entry.title}</p>
                            <p className="text-xs text-muted-foreground">{entry.subtitle}</p>
                            {atMax ? (
                              <p className="mt-1 text-[0.65rem] font-medium text-muted-foreground">{t("widgets.onDashboard")}</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
