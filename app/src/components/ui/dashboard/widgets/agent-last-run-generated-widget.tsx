"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { RunArtifactsPanel } from "@/components/ui/agents/run-artifacts-panel";
import { useAgentLastRun } from "@/components/ui/dashboard/widgets/agent-widgets";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { widgetRootClass } from "@/components/ui/dashboard/widget-layout-utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { PREVIEW_RUN_ARTIFACTS } from "@/lib/agents/run-artifacts";
import { cn } from "@/lib/utils";

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
        <div className="flex h-full items-center justify-center rounded-2xl border border-border/60 bg-card p-4 text-center text-sm text-muted-foreground">
          {t("widgets.types.agent_last_run_generated.noAgentSelected")}
        </div>
      </div>
    );
  }

  if (variant === "live" && (liveFetch.notFound || (!liveFetch.loading && !agent))) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className="flex h-full items-center justify-center rounded-2xl border border-border/60 bg-card p-4 text-center text-sm text-muted-foreground">
          {t("widgets.types.agent_last_run_generated.agentNotFound")}
        </div>
      </div>
    );
  }

  const href = agentId ? `/agents/${encodeURIComponent(agentId)}` : undefined;

  return (
    <div className={cn(widgetRootClass(layoutMode), "flex min-h-0 flex-col gap-3 overflow-hidden p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {agent?.name ?? t("widgets.types.agent_last_run_generated.previewAgentName")}
          </p>
          <p className="text-xs text-muted-foreground">{t("widgets.types.agent_last_run_generated.subtitle")}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("widgets.types.agent_last_run_generated.openAgent")}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      {variant === "live" && liveFetch.loading && !liveFetch.run ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : variant === "live" && !liveFetch.run ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("widgets.types.agent_last_run_generated.noRunsYet")}
        </div>
      ) : (
        <RunArtifactsPanel
          artifacts={artifacts}
          emptyLabel={t("widgets.types.agent_last_run_generated.noArtifacts")}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}
