"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Play,
  Trash2,
  Clock,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

type Agent = {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  schedule?: string | null;
  enabled: boolean;
  createdAt: string;
};

type AgentRun = {
  id: string;
  status: string;
  trigger: string;
  input?: string | null;
  output?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

const TOOL_OPTION_IDS = [
  { id: "web_search", labelKey: "agents.toolWebSearch", icon: Globe },
  { id: "http_get", labelKey: "agents.toolHttpGet", icon: Zap },
  { id: "http_post", labelKey: "agents.toolHttpPost", icon: Zap },
] as const;

function agentToolsLabel(agent: Agent, t: (key: string, params?: Record<string, string | number>) => string): string {
  const count = agent.tools.length;
  return count === 1 ? t("agents.toolsCountOne", { count }) : t("agents.toolsCountMany", { count });
}

function AgentStatusPill({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  if (enabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
          "border-emerald-200/70 bg-emerald-50 text-emerald-700",
          "dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-400",
        )}
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
          aria-hidden
        />
        {t("agents.statusEnabled")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-border bg-muted text-muted-foreground dark:border-border/80 dark:bg-muted/30",
      )}
    >
      {t("agents.statusDisabled")}
    </span>
  );
}

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

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { labelKey: string; cls: string; icon: React.ReactNode }> = {
    PENDING: {
      labelKey: "agents.statusPending",
      cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      icon: <Clock className="size-3" />,
    },
    RUNNING: {
      labelKey: "agents.statusRunning",
      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    DONE: {
      labelKey: "agents.statusDone",
      cls: "bg-green-500/10 text-green-400 border-green-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    FAILED: {
      labelKey: "agents.statusFailed",
      cls: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: <XCircle className="size-3" />,
    },
  };
  const s = map[status] ?? { labelKey: status, cls: "bg-muted text-muted-foreground border-border/70", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", s.cls)}>
      {s.icon}
      {map[status] ? t(s.labelKey) : status}
    </span>
  );
}

function RunCard({ run }: { run: AgentRun }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const date = new Date(run.createdAt).toLocaleString();
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            <span className="text-xs text-muted-foreground capitalize">{run.trigger}</span>
          </div>
          <span className="text-xs text-muted-foreground/70">{date}</span>
        </div>
        {run.output && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? t("agents.hide") : t("agents.showOutput")}
          </button>
        )}
      </div>
      {expanded && run.output && (
        <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border/50 bg-muted/30 p-3">
          <MarkdownLite text={run.output} />
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onTrigger,
  onDelete,
  onViewRuns,
  triggering,
}: {
  agent: Agent;
  onTrigger: (id: string) => void;
  onDelete: (id: string) => void;
  onViewRuns: (agent: Agent) => void;
  triggering: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm shadow-black/[0.06] transition-colors sm:p-[1.125rem]",
        "hover:border-border hover:shadow-black/[0.08] dark:border-border/55 dark:bg-card/90 dark:shadow-black/20 dark:hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition group-hover:bg-muted dark:border-border/60 dark:bg-muted/60"
          aria-hidden
        >
          <Bot className="size-4 shrink-0" />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <AgentStatusPill enabled={agent.enabled} />
          <button
            type="button"
            onClick={() => onDelete(agent.id)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition hover:bg-muted hover:text-red-400"
            title={t("agents.deleteAgent")}
            aria-label={t("agents.deleteAgent")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground">
          {agent.name}
        </span>

        <hr className="my-4 border-0 border-t border-border/60 dark:border-border/45" />

        <div className="flex items-end justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">{agentToolsLabel(agent, t)}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onTrigger(agent.id)}
              disabled={triggering}
              className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {triggering ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3" aria-hidden />
              )}
              {t("agents.run")}
            </button>
            <button
              type="button"
              onClick={() => onViewRuns(agent)}
              className="inline-flex items-center gap-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <span>{t("agents.runs")}</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const defaultForm = {
  name: "",
  description: "",
  systemPrompt: "",
  tools: [] as string[],
  maxSteps: 20,
  schedule: "",
  input: "",
};

export function AgentsPageClient() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<Agent | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const [runsAgent, setRunsAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchRuns = useCallback(async (agentId: string) => {
    setRunsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/runs`);
      if (res.ok) setRuns((await res.json()) as AgentRun[]);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  // Poll runs while any are active
  useEffect(() => {
    if (!runsOpen || !runsAgent) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const hasActive = runs.some((r) => r.status === "PENDING" || r.status === "RUNNING");
    if (hasActive) {
      pollRef.current = setInterval(() => void fetchRuns(runsAgent.id), 3_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runsOpen, runsAgent, runs, fetchRuns]);

  const handleViewRuns = async (agent: Agent) => {
    setRunsAgent(agent);
    setRuns([]);
    setRunsOpen(true);
    await fetchRuns(agent.id);
  };

  const handleOpenTrigger = (agentOrId: Agent | string) => {
    const agent = typeof agentOrId === "string" ? agents.find((a) => a.id === agentOrId) : agentOrId;
    if (!agent) return;
    setTriggerTarget(agent);
    setForm((f) => ({ ...f, input: "" }));
    setTriggerOpen(true);
  };

  const handleTrigger = async () => {
    if (!triggerTarget) return;
    setTriggering(triggerTarget.id);
    setTriggerOpen(false);
    try {
      await fetch(`/api/agents/${triggerTarget.id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: form.input || undefined }),
      });
      if (runsAgent?.id === triggerTarget.id) await fetchRuns(triggerTarget.id);
    } finally {
      setTriggering(null);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm(t("agents.deleteConfirm"))) return;
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (runsAgent?.id === agentId) setRunsOpen(false);
    await fetchAgents();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          systemPrompt: form.systemPrompt,
          tools: form.tools,
          maxSteps: form.maxSteps,
          schedule: form.schedule || undefined,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm(defaultForm);
        await fetchAgents();
      } else {
        const data = (await res.json()) as { error?: string };
        setCreateError(data.error ?? t("agents.createFailed"));
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(toolId) ? f.tools.filter((t) => t !== toolId) : [...f.tools, toolId],
    }));
  };

  const openCreate = () => {
    setCreateOpen(true);
    setCreateError("");
  };

  return (
    <div className="relative w-full flex-1">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="sr-only">{t("agents.title")}</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:gap-5" data-onboarding="agents-grid">
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
                  layout
                  className="min-w-0"
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
                    onDelete={handleDelete}
                    onViewRuns={handleViewRuns}
                    triggering={triggering === agent.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <NewAgentCard onClick={openCreate} />
        </div>
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          data-onboarding="new-agent-dialog"
          className="max-w-xl rounded-2xl border border-border/70 bg-card p-0 shadow-2xl"
        >
          <div className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">{t("agents.newAgentDialogTitle")}</DialogTitle>
          </div>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("agents.name")}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("agents.namePlaceholder")}
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("agents.description")}{" "}
                <span className="text-muted-foreground/50">{t("agents.optional")}</span>
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("agents.descriptionPlaceholder")}
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("agents.systemPrompt")}</label>
              <textarea
                required
                rows={4}
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                placeholder={t("agents.systemPromptPlaceholder")}
                className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">{t("agents.tools")}</label>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTION_IDS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                      form.tools.includes(tool.id)
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <tool.icon className="size-3" />
                    {t(tool.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agents.maxSteps")}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxSteps}
                  onChange={(e) => setForm((f) => ({ ...f, maxSteps: Number(e.target.value) }))}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("agents.cronSchedule")}{" "}
                  <span className="text-muted-foreground/50">{t("agents.optional")}</span>
                </label>
                <input
                  value={form.schedule}
                  onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                  placeholder={t("agents.cronPlaceholder")}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <button type="button" className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted">
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

      {/* Trigger Dialog */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border/70 bg-card p-0 shadow-2xl">
          <div className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("agents.runAgentTitle", { name: triggerTarget?.name ?? "" })}
            </DialogTitle>
          </div>
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("agents.input")}{" "}
                <span className="text-muted-foreground/50">{t("agents.optional")}</span>
              </label>
              <textarea
                rows={3}
                value={form.input}
                onChange={(e) => setForm((f) => ({ ...f, input: e.target.value }))}
                placeholder={t("agents.inputPlaceholder")}
                className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <button type="button" className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted">
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="button"
                onClick={() => void handleTrigger()}
                className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                <Play className="size-3.5" />
                {t("agents.runAgent")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Runs Dialog */}
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
              >
                <RefreshCw className={cn("size-4", runsLoading && "animate-spin")} />
              </button>
              <DialogClose asChild>
                <button type="button" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
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
              runs.map((run) => <RunCard key={run.id} run={run} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
