"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";

import { AgentCard } from "@/components/ui/agents/agent-card";
import { AgentEditDialog } from "@/components/ui/agents/agent-edit-dialog";
import { AgentRunCard } from "@/components/ui/agents/agent-run-card";
import { AgentTriggerDialog } from "@/components/ui/agents/agent-trigger-dialog";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { widgetRootClass } from "@/components/ui/dashboard/widget-layout-utils";
import { useTranslation } from "@/components/ui/locale-provider";
import type { Agent, AgentRun } from "@/lib/agents/agent-types";
import { getWidgetDensity } from "@/lib/dashboard/widget-size-utils";
import { cn } from "@/lib/utils";

const PREVIEW_AGENT: Agent = {
  id: "preview-agent",
  name: "Research Agent",
  description: "Sample agent for the widget gallery",
  systemPrompt: "You are a helpful research assistant.",
  tools: ["web_search"],
  toolMode: "auto",
  maxSteps: 20,
  schedule: null,
  enabled: true,
  emailOnComplete: false,
  model: "kimi-k2.6",
  createdAt: new Date().toISOString(),
};

const PREVIEW_LAST_RUN: AgentRun = {
  id: "preview-run",
  status: "DONE",
  trigger: "manual",
  output: `## Deployment review

Reviewed the latest deployment logs and found **three follow-up tasks**:

1. Rotate API keys for the staging environment
2. Update the \`docker-compose\` health check interval
3. Document the new agent scheduler behavior

### Summary

The deployment completed successfully with no critical errors. Minor warnings in the worker pool were transient and resolved automatically.

\`\`\`text
worker-2: connection pool exhausted (recovered in 12s)
\`\`\`

Next check recommended after the evening batch job.`,
  createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
};

function isActiveRun(run: AgentRun): boolean {
  return run.status === "PENDING" || run.status === "RUNNING" || run.status === "NEEDS_INPUT";
}

function useFullAgent(agentId: string | undefined, enabled: boolean) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchAgent = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
      if (res.status === 404) {
        setAgent(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setAgent(null);
        return;
      }
      setAgent((await res.json()) as Agent);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!enabled || !agentId) {
      setAgent(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    void fetchAgent();
  }, [agentId, enabled, fetchAgent]);

  return { agent, loading, notFound, refetch: fetchAgent, setAgent };
}

function useAgentLastRun(agentId: string | undefined, enabled: boolean) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchLastRun = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/runs`);
      if (res.status === 404) {
        setRun(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setRun(null);
        return;
      }
      const runs = (await res.json()) as AgentRun[];
      setRun(runs[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!enabled || !agentId) {
      setRun(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    void fetchLastRun();
  }, [agentId, enabled, fetchLastRun]);

  useEffect(() => {
    if (!enabled || !agentId || !run || !isActiveRun(run)) return;
    const interval = window.setInterval(() => void fetchLastRun(), 3_000);
    return () => window.clearInterval(interval);
  }, [agentId, enabled, run, fetchLastRun]);

  return { run, loading, notFound, refetch: fetchLastRun };
}

function emptyStateClass(layoutMode: DashboardWidgetRenderProps["layoutMode"]) {
  return cn(
    "flex h-full flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-4 text-center text-sm text-muted-foreground shadow-sm dark:border-border/50 dark:bg-card/90",
    layoutMode === "fluid" ? "min-h-[8rem]" : "",
  );
}

type InteractiveAgentCardWidgetProps = DashboardWidgetRenderProps & {
  emptyNoSelectMessage: string;
  emptyNotFoundMessage: string;
  previewName: string;
};

/** Classic agents-page AgentCard with Run / edit / enable — used by agent_shortcut. */
export function InteractiveAgentCardWidget({
  widget,
  variant,
  layoutMode = "grid",
  emptyNoSelectMessage,
  emptyNotFoundMessage,
  previewName,
}: InteractiveAgentCardWidgetProps) {
  const router = useRouter();
  const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
  const live = variant === "live";

  const fullAgent = useFullAgent(agentId, live);

  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const agent =
    variant === "preview" ? { ...PREVIEW_AGENT, name: previewName } : fullAgent.agent;

  if (!agentId && live) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>{emptyNoSelectMessage}</div>
      </div>
    );
  }

  if (live && (fullAgent.notFound || (!fullAgent.loading && !agent))) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>{emptyNotFoundMessage}</div>
      </div>
    );
  }

  if (live && fullAgent.loading && !agent) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </div>
    );
  }

  if (!agent) return null;

  const handleEnabledChange = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      fullAgent.setAgent((await res.json()) as Agent);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      fullAgent.setAgent(null);
    }
  };

  return (
    <div
      className={cn(
        "h-full min-h-0",
        layoutMode === "grid" ? "overflow-auto" : "overflow-visible",
        variant === "preview" && "pointer-events-none",
      )}
    >
      <AgentCard
        agent={agent}
        triggering={triggering}
        onTrigger={() => {
          if (!agent.enabled) return;
          setTriggerOpen(true);
        }}
        onDelete={(id) => void handleDelete(id)}
        onViewRuns={() => {
          void router.push(`/agents?highlight=${encodeURIComponent(agent.id)}`);
        }}
        onEdit={() => setEditOpen(true)}
        onEnabledChange={handleEnabledChange}
      />

      {live ? (
        <>
          <AgentTriggerDialog
            agent={agent}
            open={triggerOpen}
            onOpenChange={setTriggerOpen}
            onBusyChange={setTriggering}
          />
          <AgentEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            agent={agent}
            onSaved={() => {
              void fullAgent.refetch();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** Latest run preview for a selected agent (unchanged from prior behavior). */
export function AgentLastRunWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
  const agent =
    variant === "preview"
      ? data.agents[0] ?? { id: "preview-agent", name: t("widgets.types.agent_last_run.previewAgentName") }
      : data.agents.find((entry) => entry.id === agentId) ?? null;

  const liveFetch = useAgentLastRun(agentId, variant === "live");
  const run = variant === "preview" ? PREVIEW_LAST_RUN : liveFetch.run;
  const loading = variant === "live" && liveFetch.loading;
  const agentMissing = variant === "live" && Boolean(agentId) && !agent;
  const agentNotFound = variant === "live" && liveFetch.notFound;

  if (!agentId && variant === "live") {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>{t("widgets.types.agent_last_run.noAgentSelected")}</div>
      </div>
    );
  }

  if (agentMissing || agentNotFound) {
    return (
      <div className={widgetRootClass(layoutMode)}>
        <div className={emptyStateClass(layoutMode)}>{t("widgets.types.agent_last_run.agentNotFound")}</div>
      </div>
    );
  }

  const resolvedAgentId = agent?.id ?? agentId ?? "preview-agent";
  const agentHref = `/agents?highlight=${encodeURIComponent(resolvedAgentId)}`;
  const density = getWidgetDensity(widget.w, widget.h);
  const compactHeader = density === "compact" || widget.w <= 5;

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border/50 dark:bg-card/90",
        layoutMode === "grid" ? "overflow-hidden" : "overflow-visible",
        variant === "preview" && "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 sm:px-5",
          compactHeader ? "py-2" : "py-3",
        )}
      >
        <div className="min-w-0">
          <h3 className={cn("truncate font-semibold text-foreground", compactHeader ? "text-xs" : "text-sm")}>
            {agent?.name}
          </h3>
          {!compactHeader ? (
            <p className="text-xs text-muted-foreground">{t("widgets.types.agent_last_run.subtitle")}</p>
          ) : null}
        </div>
        {variant === "live" ? (
          <Link href={agentHref} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
            {t("widgets.types.agent_last_run.openAgent")}
          </Link>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {loading && !run ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : !run ? (
          <div className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
            {t("widgets.types.agent_last_run.noRunsYet")}
          </div>
        ) : (
          <AgentRunCard run={run} agentId={resolvedAgentId} variant="embedded" />
        )}
      </div>
    </section>
  );
}
