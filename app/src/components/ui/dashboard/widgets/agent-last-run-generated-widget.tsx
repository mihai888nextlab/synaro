"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { RunArtifactsPanel } from "@/components/ui/agents/run-artifacts-panel";
import { useAgentLastRun } from "@/components/ui/dashboard/widgets/agent-widgets";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { widgetRootClass } from "@/components/ui/dashboard/widget-layout-utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { PREVIEW_RUN_ARTIFACTS } from "@/lib/agents/run-artifacts";
import { getWidgetDensity } from "@/lib/dashboard/widget-size-utils";
import { cn } from "@/lib/utils";

const cardShell =
  "flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border/50 dark:bg-card/90";

function emptyStateClass(layoutMode: DashboardWidgetRenderProps["layoutMode"]) {
  return cn(
    "flex h-full flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-4 text-center text-sm text-muted-foreground shadow-sm dark:border-border/50 dark:bg-card/90",
    layoutMode === "grid" ? "h-full" : "min-h-[10rem]",
  );
}

export function AgentLastRunGeneratedWidget({
  data,
  widget,
  variant,
  layoutMode = "grid",
}: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
  const agent =
    variant === "preview"
      ? data.agents[0] ?? {
          id: "preview-agent",
          name: t("widgets.types.agent_last_run_generated.previewAgentName"),
        }
      : data.agents.find((a) => a.id === agentId);

  const liveFetch = useAgentLastRun(agentId, variant === "live");
  const artifacts = variant === "preview" ? PREVIEW_RUN_ARTIFACTS : liveFetch.run?.artifacts;

  if (!agentId && variant === "live") {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>
          {t("widgets.types.agent_last_run_generated.noAgentSelected")}
        </div>
      </div>
    );
  }

  if (variant === "live" && (liveFetch.notFound || (!liveFetch.loading && !agent))) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>
          {t("widgets.types.agent_last_run_generated.agentNotFound")}
        </div>
      </div>
    );
  }

  const href = agentId ? `/agents?highlight=${encodeURIComponent(agentId)}` : undefined;
  const density = getWidgetDensity(widget.w, widget.h);
  const compactHeader = density === "compact" || widget.w <= 5;

  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <section className={cardShell}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 sm:px-5",
            compactHeader ? "py-2" : "py-3",
          )}
        >
          <div className="min-w-0">
            <h3
              className={cn(
                "truncate font-semibold text-foreground",
                compactHeader ? "text-xs" : "text-sm",
              )}
            >
              {agent?.name ?? t("widgets.types.agent_last_run_generated.previewAgentName")}
            </h3>
            {!compactHeader ? (
              <p className="text-xs text-muted-foreground">
                {t("widgets.types.agent_last_run_generated.subtitle")}
              </p>
            ) : null}
          </div>
          {href ? (
            <Link
              href={href}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("widgets.types.agent_last_run_generated.openAgent")}
            </Link>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {variant === "live" && liveFetch.loading && !liveFetch.run ? (
            <div className="flex flex-1 items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : variant === "live" && !liveFetch.run ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
              {t("widgets.types.agent_last_run_generated.noRunsYet")}
            </div>
          ) : (
            <RunArtifactsPanel
              artifacts={artifacts}
              emptyLabel={t("widgets.types.agent_last_run_generated.noArtifacts")}
              className="min-h-0 flex-1"
              dense
            />
          )}
        </div>
      </section>
    </div>
  );
}
