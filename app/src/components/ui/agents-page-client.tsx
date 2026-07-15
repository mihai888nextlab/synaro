"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Play,
  Square,
  Trash2,
  Pencil,
  Power,
  Clock,
  Globe,
  Zap,
  FolderGit2,
  Activity,
  FileText,
  Brain,
  Plug,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  Play,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { invalidateSearchIndex, prefetchSearchIndex } from "@/hooks/use-search-index";
import { useAgentBackgroundRuns } from "@/components/ui/agent-background-runs";
import {
  AgentRunComposer,
  buildAgentRunInput,
} from "@/components/ui/agent-run-composer";
import { markVoiceTriggeredRun } from "@/lib/speech/voice-triggered-runs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { AgentCard } from "@/components/ui/agents/agent-card";
import { AgentEditDialog } from "@/components/ui/agents/agent-edit-dialog";
import { AgentFormFields } from "@/components/ui/agents/agent-form-fields";
import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import {
  DEFAULT_AGENT_FORM_VALUES,
  type Agent,
  type AgentRun,
} from "@/lib/agents/agent-types";

type McpServer = { name: string; url: string; transport?: "http" | "sse"; headers?: Record<string, string> };

type Agent = {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  schedule?: string | null;
  enabled: boolean;
  model?: string | null;
  mcpServers?: McpServer[] | null;
  createdAt: string;
};

type ReActStep = { step: number; tool: string; args: Record<string, unknown>; observation: string };

type AgentRun = {
  id: string;
  status: string;
  trigger: string;
  input?: string | null;
  output?: string | null;
  steps?: ReActStep[] | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

/** Full tool catalog, grouped. Ids must match agent-runner's tool names. */
const TOOL_CATALOG = [
  { id: "web_search", labelKey: "agents.toolWebSearch", icon: Globe },
  { id: "http_get", labelKey: "agents.toolHttpGet", icon: Zap },
  { id: "http_post", labelKey: "agents.toolHttpPost", icon: Zap },
  { id: "list_projects", labelKey: "agents.toolListProjects", icon: FolderGit2 },
  { id: "get_project", labelKey: "agents.toolGetProject", icon: FolderGit2 },
  { id: "list_project_runs", labelKey: "agents.toolListProjectRuns", icon: Activity },
  { id: "start_project", labelKey: "agents.toolStartProject", icon: Play },
  { id: "stop_project", labelKey: "agents.toolStopProject", icon: Square },
  { id: "list_files", labelKey: "agents.toolListFiles", icon: FileText },
  { id: "read_file", labelKey: "agents.toolReadFile", icon: FileText },
  { id: "write_file", labelKey: "agents.toolWriteFile", icon: FileText },
  { id: "delete_file", labelKey: "agents.toolDeleteFile", icon: FileText },
  { id: "run_agent", labelKey: "agents.toolRunAgent", icon: Users },
  { id: "remember", labelKey: "agents.toolRemember", icon: Brain },
  { id: "recall", labelKey: "agents.toolRecall", icon: Brain },
  { id: "mcp", labelKey: "agents.toolMcp", icon: Plug },
] as const;

const MODEL_OPTIONS = ["kimi-k2.6", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] as const;

type AgentForm = {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  schedule: string;
  model: string;
  mcpServers: string;
  input: string;
};

const defaultForm: AgentForm = {
  name: "",
  description: "",
  systemPrompt: "",
  tools: [],
  maxSteps: 20,
  schedule: "",
  model: MODEL_OPTIONS[0],
  mcpServers: "",
  input: "",
};

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

function RunCard({ run, agentId }: { run: AgentRun; agentId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = new Date(run.createdAt).toLocaleString();

  const openRunDetail = () => {
    void router.push(`/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(run.id)}`);
  };

/** Live, per-step timeline of a run (tool + args + observation). */
function StepTimeline({ steps }: { steps: ReActStep[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={i} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-[0.625rem] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="font-mono font-medium text-foreground">{s.tool}</span>
          </div>
          {Object.keys(s.args ?? {}).length > 0 && (
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[0.6875rem] text-muted-foreground">
              {JSON.stringify(s.args, null, 2)}
            </pre>
          )}
          {s.observation && (
            <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap break-words text-muted-foreground/90">
              {s.observation}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function RunCard({ run }: { run: AgentRun }) {
  const { t } = useTranslation();
  const active = run.status === "RUNNING" || run.status === "PENDING";
  const [expanded, setExpanded] = useState(false);
  const date = new Date(run.createdAt).toLocaleString();
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const hasDetail = Boolean(run.output) || steps.length > 0;
  const open = expanded || active;
  return (
    <button
      type="button"
      onClick={openRunDetail}
      className="w-full rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-border hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <AgentStatusBadge status={run.status} />
            <span className="text-xs text-muted-foreground capitalize">{run.trigger}</span>
            {steps.length > 0 && (
              <span className="text-xs text-muted-foreground/70">
                {t("agents.stepsCount", { count: steps.length })}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground/70">{date}</span>
        </div>
        {hasDetail && !active && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? t("agents.hide") : t("agents.showOutput")}
          </button>
        )}
      </div>
      {open && steps.length > 0 && (
        <div className="mt-3 max-h-72 overflow-auto">
          <StepTimeline steps={steps} />
        </div>
      )}
      {open && run.output && (
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
  onEdit,
  onToggleEnabled,
  onDelete,
  onViewRuns,
  triggering,
  toggling,
}: {
  agent: Agent;
  onTrigger: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onToggleEnabled: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onViewRuns: (agent: Agent) => void;
  triggering: boolean;
  toggling: boolean;
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
            onClick={() => onToggleEnabled(agent)}
            disabled={toggling}
            className={cn(
              "shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition hover:bg-muted disabled:opacity-50",
              agent.enabled ? "hover:text-amber-500" : "hover:text-emerald-500",
            )}
            title={agent.enabled ? t("agents.disableAgent") : t("agents.enableAgent")}
            aria-label={agent.enabled ? t("agents.disableAgent") : t("agents.enableAgent")}
          >
            {toggling ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onEdit(agent)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
            title={t("agents.editAgent")}
            aria-label={t("agents.editAgent")}
          >
            <Pencil className="size-3.5" />
          </button>
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

/** Shared field set used by both the create and edit dialogs. */
function AgentFormFields({
  form,
  setForm,
}: {
  form: AgentForm;
  setForm: React.Dispatch<React.SetStateAction<AgentForm>>;
}) {
  const { t } = useTranslation();
  const toggleTool = (toolId: string) => {
    setForm((f) => ({
      ...f,
      tools: f.tools.includes(toolId) ? f.tools.filter((x) => x !== toolId) : [...f.tools, toolId],
    }));
  };
  return (
    <>
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
          {t("agents.description")} <span className="text-muted-foreground/50">{t("agents.optional")}</span>
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
          {TOOL_CATALOG.map((tool) => (
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
      {form.tools.includes("mcp") && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("agents.mcpServers")} <span className="text-muted-foreground/50">{t("agents.mcpServersHint")}</span>
          </label>
          <textarea
            rows={4}
            value={form.mcpServers}
            onChange={(e) => setForm((f) => ({ ...f, mcpServers: e.target.value }))}
            placeholder={'[{ "name": "example", "url": "https://mcp.example.com/mcp" }]'}
            className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("agents.model")}</label>
          <div className="relative">
            <select
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
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
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t("agents.cronSchedule")} <span className="text-muted-foreground/50">{t("agents.optional")}</span>
        </label>
        <input
          value={form.schedule}
          onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
          placeholder={t("agents.cronPlaceholder")}
          className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </>
  );
}

/** Parse the MCP-servers textarea into an array (empty when blank). Throws on invalid JSON. */
function parseMcpServers(raw: string): McpServer[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) throw new Error("expected an array");
  return parsed as McpServer[];
}

export function AgentsPageClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AgentForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState<AgentForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [triggering, setTriggering] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<Agent | null>(null);
  const [triggerAttachments, setTriggerAttachments] = useState<File[]>([]);
  const [runsOpen, setRunsOpen] = useState(false);
  const [runsAgent, setRunsAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const highlightHandledRef = useRef<string | null>(null);
  const voiceInitiatedRef = useRef(false);
  const { refreshSoon: refreshAgentRunsSoon } = useAgentBackgroundRuns();

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
    const hasActive = runs.some((r) => r.status === "PENDING" || r.status === "RUNNING");
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
    setForm((f) => ({ ...f, input: "" }));
    setTriggerAttachments([]);
    voiceInitiatedRef.current = false;
    setTriggerOpen(true);
  };

  const handleTrigger = async (options?: { fromVoice?: boolean; input?: string }) => {
    if (!triggerTarget) return;
    const voiceInitiated = options?.fromVoice || voiceInitiatedRef.current;
    setTriggering(triggerTarget.id);
    setTriggerOpen(false);
    try {
      const inputText = options?.input ?? form.input;
      const input = await buildAgentRunInput(inputText, triggerAttachments);
      const res = await fetch(`/api/agents/${triggerTarget.id}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (res.ok) {
        const data = (await res.json()) as { runId?: string };
        if (voiceInitiated && data.runId) {
          markVoiceTriggeredRun(data.runId);
        }
      }
      refreshAgentRunsSoon();
      if (runsAgent?.id === triggerTarget.id) await fetchRuns(triggerTarget.id);
    } finally {
      setTriggering(null);
      setTriggerAttachments([]);
      setForm((f) => ({ ...f, input: "" }));
      voiceInitiatedRef.current = false;
    }
  };

  const handleToggleEnabled = async (agent: Agent) => {
    setTogglingId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      if (res.ok) await fetchAgents();
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenEdit = async (agent: Agent) => {
    setEditTarget(agent);
    setEditError("");
    // Prefill from the freshest copy (the list row already has everything, but GET keeps us honest).
    let full = agent;
    try {
      const res = await fetch(`/api/agents/${agent.id}`);
      if (res.ok) full = (await res.json()) as Agent;
    } catch {
      /* fall back to the list row */
    }
    setEditForm({
      name: full.name,
      description: full.description ?? "",
      systemPrompt: full.systemPrompt,
      tools: full.tools ?? [],
      maxSteps: full.maxSteps,
      schedule: full.schedule ?? "",
      model: full.model ?? MODEL_OPTIONS[0],
      mcpServers: full.mcpServers ? JSON.stringify(full.mcpServers, null, 2) : "",
      input: "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setEditError("");
    let mcpServers: McpServer[] = [];
    try {
      if (editForm.tools.includes("mcp")) mcpServers = parseMcpServers(editForm.mcpServers);
    } catch {
      setEditError(t("agents.mcpServersInvalid"));
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/agents/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          systemPrompt: editForm.systemPrompt,
          tools: editForm.tools,
          maxSteps: editForm.maxSteps,
          schedule: editForm.schedule || null,
          model: editForm.model,
          mcpServers,
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        await fetchAgents();
        invalidateSearchIndex();
        void prefetchSearchIndex();
      } else {
        const data = (await res.json()) as { error?: string };
        setEditError(typeof data.error === "string" ? data.error : t("agents.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
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
    let mcpServers: McpServer[] = [];
    try {
      if (form.tools.includes("mcp")) mcpServers = parseMcpServers(form.mcpServers);
    } catch {
      setCreateError(t("agents.mcpServersInvalid"));
      setCreating(false);
      return;
    }
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
          model: form.model,
          mcpServers,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm({ ...DEFAULT_AGENT_FORM_VALUES, input: "" });
        await refreshAgentsAndSearch();
      } else {
        const data = (await res.json()) as { error?: string };
        setCreateError(typeof data.error === "string" ? data.error : t("agents.createFailed"));
      }
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setForm(defaultForm);
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
                    onToggleEnabled={handleToggleEnabled}
                    onDelete={handleDelete}
                    onViewRuns={handleViewRuns}
                    onEdit={handleOpenEdit}
                    onEnabledChange={handleEnabledChange}
                    triggering={triggering === agent.id}
                    toggling={togglingId === agent.id}
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
            <DialogTitle className="text-base font-semibold text-foreground">{t("agents.newAgentDialogTitle")}</DialogTitle>
          </div>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-4 px-6 py-5">
            <AgentFormFields form={form} setForm={setForm} />
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

      {/* Edit Agent Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border border-border/70 bg-card p-0 shadow-2xl">
          <div className="border-b border-border/70 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("agents.editAgentTitle", { name: editTarget?.name ?? "" })}
            </DialogTitle>
          </div>
          <form onSubmit={(e) => void handleUpdate(e)} className="flex flex-col gap-4 px-6 py-5">
            <AgentFormFields form={editForm} setForm={setEditForm} />
            {editError && <p className="text-xs text-red-400">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <button type="button" className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted">
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {t("agents.saveChanges")}
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
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t("agents.input")} <span className="text-muted-foreground/50">{t("agents.optional")}</span>
              </label>
              <AgentRunComposer
                value={form.input}
                onChange={(input) => setForm((f) => ({ ...f, input }))}
                attachments={triggerAttachments}
                onAttachmentsChange={setTriggerAttachments}
                placeholder={t("agents.inputPlaceholder")}
                voiceInitiatedRef={voiceInitiatedRef}
                onVoiceUtteranceEnd={(text) => {
                  if (text.trim()) void handleTrigger({ fromVoice: true, input: text });
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="button"
                onClick={() => void handleTrigger()}
                disabled={Boolean(triggering)}
                className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {triggering ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {t("agents.runAgent")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              runs.map((run) => <RunCard key={run.id} run={run} agentId={runsAgent!.id} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
