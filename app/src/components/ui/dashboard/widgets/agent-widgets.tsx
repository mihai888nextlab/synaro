"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";

import { AgentCard } from "@/components/ui/agents/agent-card";
import { AgentEditDialog } from "@/components/ui/agents/agent-edit-dialog";
import { AgentTriggerDialog } from "@/components/ui/agents/agent-trigger-dialog";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { widgetRootClass } from "@/components/ui/dashboard/widget-layout-utils";
import { useTranslation } from "@/components/ui/locale-provider";
import type { Agent, AgentRun } from "@/lib/agents/agent-types";
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
  model: "kimi-k2.7-code",
  createdAt: new Date().toISOString(),
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

function runPollFingerprint(run: AgentRun): string {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const last = steps.length > 0 ? steps[steps.length - 1] : null;
  const lastObs =
    last && typeof last === "object" && last !== null && "observation" in last
      ? String((last as { observation?: unknown }).observation ?? "")
      : "";
  const lastTool =
    last && typeof last === "object" && last !== null && "tool" in last
      ? String((last as { tool?: unknown }).tool ?? "")
      : "";
  return [
    run.id,
    run.status,
    run.finishedAt ?? "",
    run.startedAt ?? "",
    run.output?.length ?? 0,
    run.output?.slice(0, 120) ?? "",
    JSON.stringify(run.artifacts ?? null).slice(0, 240),
    steps.length,
    lastTool,
    lastObs.length,
    lastObs.slice(0, 120),
  ].join("\x1e");
}

export function useAgentLastRun(agentId: string | undefined, enabled: boolean) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const hasLoadedRef = useRef(false);
  const fingerprintRef = useRef<string | null>(null);

  const fetchLastRun = useCallback(async (opts?: { silent?: boolean }) => {
    if (!agentId) return;
    if (!opts?.silent && !hasLoadedRef.current) setLoading(true);
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/runs?limit=1&compact=1`,
        { cache: "no-store" },
      );
      if (res.status === 404) {
        fingerprintRef.current = null;
        setRun(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        return;
      }
      setNotFound(false);
      const runs = (await res.json()) as AgentRun[];
      const next = runs[0] ?? null;
      if (!next) {
        fingerprintRef.current = null;
        setRun(null);
        return;
      }
      const fingerprint = runPollFingerprint(next);
      if (fingerprintRef.current === fingerprint) return;
      fingerprintRef.current = fingerprint;
      setRun(next);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    hasLoadedRef.current = false;
    fingerprintRef.current = null;
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
    const interval = window.setInterval(() => void fetchLastRun({ silent: true }), 3_000);
    return () => window.clearInterval(interval);
  }, [agentId, enabled, run?.id, run?.status, fetchLastRun]);

  // Refresh when background agent polling reports a change for this agent.
  useEffect(() => {
    if (!enabled || !agentId) return;
    const onFocus = () => void fetchLastRun({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [agentId, enabled, fetchLastRun]);

  return { run, loading, notFound, refetch: () => fetchLastRun({ silent: true }) };
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
