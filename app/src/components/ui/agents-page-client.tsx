"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { invalidateSearchIndex, prefetchSearchIndex } from "@/hooks/use-search-index";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { AgentCard } from "@/components/ui/agents/agent-card";
import { AgentEditDialog } from "@/components/ui/agents/agent-edit-dialog";
import { AgentFormFields } from "@/components/ui/agents/agent-form-fields";
import { AgentRunCard } from "@/components/ui/agents/agent-run-card";
import { AgentTriggerDialog } from "@/components/ui/agents/agent-trigger-dialog";
import {
  buildAgentCreateBody,
  DEFAULT_AGENT_FORM_VALUES,
  formatAgentApiError,
  parseMcpServers,
  type Agent,
  type AgentFormValues,
  type AgentRun,
} from "@/lib/agents/agent-types";
import { cronStringToScheduleUi, validateScheduleUi } from "@/lib/agents/agent-schedule";
import { agentFormValuesFromWorkspaceSettings, type UserWorkspaceSettings } from "@/lib/user-workspace-settings";

function NewAgentCard({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-onboarding="new-agent"
      onClick={onClick}
      className={cn(
        "flex min-h-[11.25rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-5 py-8 text-sm font-medium text-muted-foreground transition sm:min-h-[12rem]",
        "hover:border-border hover:bg-muted/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/55 dark:hover:bg-muted/15",
      )}
    >
      {t("agents.newAgent")}
    </button>
  );
}

export function AgentsPageClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AgentFormValues>(DEFAULT_AGENT_FORM_VALUES);
  const [agentCreateDefaults, setAgentCreateDefaults] = useState(DEFAULT_AGENT_FORM_VALUES);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<Agent | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const [runsAgent, setRunsAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightHandledRef = useRef<string | null>(null);
  const runHandledRef = useRef<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) setAgents((await res.json()) as Agent[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/account/workspace-settings");
        if (!res.ok) return;
        const settings = (await res.json()) as UserWorkspaceSettings;
        setAgentCreateDefaults({
          ...DEFAULT_AGENT_FORM_VALUES,
          ...agentFormValuesFromWorkspaceSettings(settings),
        });
      } catch {
        /* keep built-in defaults */
      }
    })();
  }, []);

  useEffect(() => {
    const raw = router.query.highlight;
    const highlightId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!highlightId || loading) return;
    if (highlightHandledRef.current === highlightId) return;
    if (!agents.some((agent) => agent.id === highlightId)) return;

    highlightHandledRef.current = highlightId;
    setHighlightedAgentId(highlightId);

    requestAnimationFrame(() => {
      document.getElementById(`agent-card-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    void router.replace("/agents", undefined, { shallow: true });

    const timer = window.setTimeout(() => setHighlightedAgentId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [agents, loading, router, router.query.highlight]);

  useEffect(() => {
    const raw = router.query.create;
    const shouldOpen = raw === "1" || raw === "true";
    if (!shouldOpen || loading) return;
    setCreateOpen(true);
    void router.replace("/agents", undefined, { shallow: true });
  }, [loading, router, router.query.create]);

  useEffect(() => {
    const raw = router.query.run;
    const runId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!runId || loading) return;
    if (runHandledRef.current === runId) return;
    const agent = agents.find((a) => a.id === runId);
    if (!agent) return;

    runHandledRef.current = runId;
    setHighlightedAgentId(runId);
    if (agent.enabled) {
      setTriggerTarget(agent);
      setTriggerOpen(true);
    }
    requestAnimationFrame(() => {
      document.getElementById(`agent-card-${runId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    void router.replace("/agents", undefined, { shallow: true });
    const timer = window.setTimeout(() => setHighlightedAgentId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [agents, loading, router, router.query.run]);

  const fetchRuns = useCallback(async (agentId: string) => {
    setRunsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/runs`);
      if (res.ok) setRuns((await res.json()) as AgentRun[]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runsOpen || !runsAgent) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const hasActive = runs.some(
      (r) => r.status === "PENDING" || r.status === "RUNNING" || r.status === "NEEDS_INPUT",
    );
    if (hasActive) {
      pollRef.current = setInterval(() => void fetchRuns(runsAgent.id), 3_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runsOpen, runsAgent, runs, fetchRuns]);

  const refreshAgentsAndSearch = useCallback(async () => {
    await fetchAgents();
    invalidateSearchIndex();
    void prefetchSearchIndex();
  }, [fetchAgents]);

  const handleViewRuns = async (agent: Agent) => {
    setRunsAgent(agent);
    setRuns([]);
    setRunsOpen(true);
    await fetchRuns(agent.id);
  };

  const handleOpenEdit = (agent: Agent) => {
    setEditAgent(agent);
    setEditOpen(true);
  };

  const handleEnabledChange = async (agentId: string, enabled: boolean) => {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Agent;
      setAgents((prev) => prev.map((a) => (a.id === agentId ? updated : a)));
      if (runsAgent?.id === agentId) setRunsAgent(updated);
      if (editAgent?.id === agentId) setEditAgent(updated);
      invalidateSearchIndex();
      void prefetchSearchIndex();
    } else {
      await fetchAgents();
    }
  };

  const handleOpenTrigger = (agentOrId: Agent | string) => {
    const agent = typeof agentOrId === "string" ? agents.find((a) => a.id === agentOrId) : agentOrId;
    if (!agent || !agent.enabled) return;
    setTriggerTarget(agent);
    setTriggerOpen(true);
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm(t("agents.deleteConfirm"))) return;
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (runsAgent?.id === agentId) setRunsOpen(false);
    await refreshAgentsAndSearch();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      if (form.mcpServers.trim()) {
        try {
          parseMcpServers(form.mcpServers);
        } catch {
          setCreateError(t("agents.mcpServersInvalid"));
          return;
        }
      }

      const scheduleValidation = validateScheduleUi(cronStringToScheduleUi(form.schedule));
      if (scheduleValidation) {
        setCreateError(t(`agents.${scheduleValidation}`));
        return;
      }

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAgentCreateBody(form)),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm(agentCreateDefaults);
        await refreshAgentsAndSearch();
      } else {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setCreateError(formatAgentApiError(data.error, t("agents.createFailed"), data.message));
      }
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setForm(agentCreateDefaults);
    setCreateOpen(true);
    setCreateError("");
  };

  return (
    <div className="relative w-full flex-1">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="sr-only">{t("agents.title")}</h1>

        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:gap-5"
          data-onboarding="agents-grid"
        >
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="min-h-[11.25rem] animate-pulse rounded-xl border border-border/70 bg-card sm:min-h-[12rem]"
              />
            ))
          ) : (
            <AnimatePresence initial={false}>
              {agents.map((agent) => (
                <motion.div
                  key={agent.id}
                  id={`agent-card-${agent.id}`}
                  layout
                  className={cn(
                    "min-w-0 rounded-xl transition-shadow",
                    highlightedAgentId === agent.id && "ring-2 ring-ring/60 ring-offset-2 ring-offset-background",
                  )}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    transition: { type: "spring", stiffness: 420, damping: 28, mass: 0.85 },
                  }}
                  exit={{
                    scale: [1, 1.04, 0],
                    opacity: [1, 1, 0],
                    transition: {
                      duration: 0.32,
                      times: [0, 0.2, 1],
                      ease: "easeOut",
                    },
                  }}
                >
                  <AgentCard
                    agent={agent}
                    onTrigger={handleOpenTrigger}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    onViewRuns={handleViewRuns}
                    onEnabledChange={handleEnabledChange}
                    triggering={triggering === agent.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <NewAgentCard onClick={openCreate} />
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          data-onboarding="new-agent-dialog"
          className="max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border border-border/70 bg-card p-0 shadow-2xl"
        >
          <div className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("agents.newAgentDialogTitle")}
            </DialogTitle>
          </div>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4 px-6 py-5">
            <AgentFormFields value={form} onChange={setForm} />
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {creating && <Loader2 className="size-3.5 animate-spin" />}
                {t("agents.createAgent")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AgentEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agent={editAgent}
        onSaved={refreshAgentsAndSearch}
      />

      <AgentTriggerDialog
        agent={triggerTarget}
        open={triggerOpen}
        onOpenChange={setTriggerOpen}
        onBusyChange={(busy) => {
          setTriggering(busy && triggerTarget ? triggerTarget.id : null);
        }}
        onTriggered={() => {
          if (runsAgent && runsAgent.id === triggerTarget?.id) void fetchRuns(runsAgent.id);
        }}
      />

      <Dialog open={runsOpen} onOpenChange={setRunsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border border-border/70 bg-card p-0 shadow-2xl">
          <div className="flex flex-row items-center justify-between border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("agents.runsTitle", { name: runsAgent?.name ?? "" })}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runsAgent && void fetchRuns(runsAgent.id)}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title={t("agents.refresh")}
                aria-label={t("agents.refresh")}
              >
                <RefreshCw className={cn("size-4", runsLoading && "animate-spin")} />
              </button>
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={t("a11y.closeDialog")}
                >
                  <X className="size-4" />
                </button>
              </DialogClose>
            </div>
          </div>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-6 py-5">
            {runsLoading && runs.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("agents.noRunsYet")}
              </div>
            ) : (
              runs.map((run) => <AgentRunCard key={run.id} run={run} agentId={runsAgent!.id} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
