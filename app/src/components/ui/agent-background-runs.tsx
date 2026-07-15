"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronRight, StopCircle, VolumeX } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import {
  playNotificationSound,
  showBrowserNotification,
  useNotifications,
} from "@/components/ui/notifications";
import { useSpeechOutput } from "@/lib/speech/speech-output-provider";
import { consumeVoiceTriggeredRun } from "@/lib/speech/voice-triggered-runs";
import { cn } from "@/lib/utils";

export type AgentRunStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | string;

export type ActiveAgentRun = {
  id: string;
  agentId: string;
  status: AgentRunStatus;
  output?: string | null;
  agent?: { id: string; name: string } | null;
};

type RunSnapshot = {
  agentId: string;
  agentName: string;
  status: AgentRunStatus;
};

type Ctx = {
  activeRuns: ActiveAgentRun[];
  refreshSoon: () => void;
};

const POLL_MS = 3_000;

const AgentBackgroundRunsContext = React.createContext<Ctx | null>(null);

function isActiveStatus(status: AgentRunStatus) {
  return status === "PENDING" || status === "RUNNING" || status === "NEEDS_INPUT";
}

function isTerminalStatus(status: AgentRunStatus) {
  return status === "DONE" || status === "FAILED" || status === "CANCELLED";
}

function agentNameFromRun(run: ActiveAgentRun) {
  return run.agent?.name?.trim() || "Agent";
}

export function AgentBackgroundRunsProvider({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus } = useSession();
  const { push } = useNotifications();
  const { t } = useTranslation();
  const { speak } = useSpeechOutput();
  const [activeRuns, setActiveRuns] = React.useState<ActiveAgentRun[]>([]);

  const initializedRef = React.useRef(false);
  const statusByRunIdRef = React.useRef(new Map<string, RunSnapshot>());
  const notifiedRunIdsRef = React.useRef(new Set<string>());
  const pollRef = React.useRef<(() => Promise<void>) | null>(null);

  const refreshSoon = React.useCallback(() => {
    void pollRef.current?.();
  }, []);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated") {
      initializedRef.current = false;
      statusByRunIdRef.current.clear();
      setActiveRuns([]);
      pollRef.current = null;
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function fetchRun(runId: string): Promise<ActiveAgentRun | null> {
      try {
        const res = await fetch(`/api/agents/runs/${encodeURIComponent(runId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        return (await res.json()) as ActiveAgentRun;
      } catch {
        return null;
      }
    }

    function notifyTerminal(run: ActiveAgentRun, snapshot: RunSnapshot) {
      if (notifiedRunIdsRef.current.has(run.id)) return;
      notifiedRunIdsRef.current.add(run.id);

      const agentName = snapshot.agentName || agentNameFromRun(run);
      const failed = run.status === "FAILED";
      const title = failed
        ? t("notifications.agentRunFailed", { name: agentName })
        : t("notifications.agentRunComplete", { name: agentName });
      const description =
        run.output?.trim()?.slice(0, 160) ||
        (failed ? undefined : t("notifications.agentRunCompleteBody"));

      push({
        type: failed ? "agent_run_failed" : "agent_run_done",
        title,
        description,
        href: `/agents/${encodeURIComponent(snapshot.agentId)}/runs/${encodeURIComponent(run.id)}`,
        meta: { runId: run.id, agentId: snapshot.agentId },
      });

      showBrowserNotification(title, {
        body: description,
        tag: `synaro-agent-${run.id}`,
      });
      playNotificationSound();

      if (consumeVoiceTriggeredRun(run.id)) {
        const speechText = failed
          ? run.output?.trim() || t("agents.voiceRunFailedFallback", { name: agentName })
          : run.output?.trim() || "";
        if (speechText) speak(speechText);
      }
    }

    async function poll() {
      try {
        const res = await fetch("/api/agents/active-runs", { cache: "no-store" });
        if (!res.ok) return;
        const runs = (await res.json()) as ActiveAgentRun[];
        if (cancelled) return;

        const activeIds = new Set(runs.map((r) => r.id));

        if (!initializedRef.current) {
          for (const run of runs) {
            statusByRunIdRef.current.set(run.id, {
              agentId: run.agentId,
              agentName: agentNameFromRun(run),
              status: run.status,
            });
          }
          initializedRef.current = true;
          setActiveRuns(runs.filter((r) => isActiveStatus(r.status)));
          return;
        }

        for (const [runId, snapshot] of [...statusByRunIdRef.current.entries()]) {
          if (activeIds.has(runId) || !isActiveStatus(snapshot.status)) continue;
          const run = await fetchRun(runId);
          if (cancelled) return;
          if (run && isTerminalStatus(run.status)) {
            notifyTerminal(run, snapshot);
          }
          statusByRunIdRef.current.delete(runId);
        }

        for (const run of runs) {
          const snapshot: RunSnapshot = {
            agentId: run.agentId,
            agentName: agentNameFromRun(run),
            status: run.status,
          };
          const prev = statusByRunIdRef.current.get(run.id);
          if (prev && isActiveStatus(prev.status) && isTerminalStatus(run.status)) {
            notifyTerminal(run, prev);
          }
          statusByRunIdRef.current.set(run.id, snapshot);
        }

        setActiveRuns(runs.filter((r) => isActiveStatus(r.status)));
      } catch {
        // ignore transient errors
      }
    }

    pollRef.current = poll;
    void poll();
    timer = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      pollRef.current = null;
      if (timer) clearInterval(timer);
    };
  }, [sessionStatus, push, speak, t]);

  const value = React.useMemo(
    () => ({ activeRuns, refreshSoon }),
    [activeRuns, refreshSoon],
  );

  return (
    <AgentBackgroundRunsContext.Provider value={value}>
      {children}
    </AgentBackgroundRunsContext.Provider>
  );
}

export function useAgentBackgroundRuns() {
  const ctx = React.useContext(AgentBackgroundRunsContext);
  if (!ctx) {
    throw new Error("useAgentBackgroundRuns must be used within AgentBackgroundRunsProvider");
  }
  return ctx;
}

export function AgentSpeechStopButton({ className }: { className?: string }) {
  const { isSpeaking, stop } = useSpeechOutput();
  const { t } = useTranslation();

  if (!isSpeaking) return null;

  return (
    <button
      type="button"
      onClick={stop}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border border-border/35 bg-muted/15 px-2 py-0.5",
        "text-[11px] leading-none text-muted-foreground",
        "transition-colors hover:border-border/55 hover:bg-muted/35 hover:text-foreground",
        className,
      )}
      aria-label={t("agents.speakingAria")}
      title={t("agents.stopSpeaking")}
    >
      <VolumeX className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{t("agents.stopSpeaking")}</span>
    </button>
  );
}

export function AgentActiveRunsPill({ className }: { className?: string }) {
  const { activeRuns, refreshSoon } = useAgentBackgroundRuns();
  const { t } = useTranslation();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  if (activeRuns.length === 0) return null;

  const label =
    activeRuns.length === 1
      ? t("agents.headerPillSingle", { name: agentNameFromRun(activeRuns[0]!) })
      : t("agents.headerPillMany", { count: activeRuns.length });

  const href =
    activeRuns.length === 1
      ? `/agents/${encodeURIComponent(activeRuns[0]!.agentId)}/runs/${encodeURIComponent(activeRuns[0]!.id)}`
      : "/agents";

  const title =
    activeRuns.length === 1
      ? t("agents.headerPillTitleSingle", { name: agentNameFromRun(activeRuns[0]!) })
      : t("agents.headerPillTitleMany", { count: activeRuns.length });

  async function cancelRun(runId: string) {
    if (!window.confirm(t("agents.cancelRunConfirm"))) return;
    setCancellingId(runId);
    try {
      const res = await fetch(`/api/agents/runs/${encodeURIComponent(runId)}/cancel`, {
        method: "POST",
      });
      if (res.ok) refreshSoon();
    } finally {
      setCancellingId(null);
    }
  }

  const singleRun = activeRuns.length === 1 ? activeRuns[0]! : null;

  return (
    <div
      className={cn(
        "inline-flex max-w-[12rem] items-center gap-0.5 rounded-full",
        "border border-border/35 bg-muted/15",
        "text-[11px] leading-none text-muted-foreground",
        className,
      )}
    >
      <Link
        href={href}
        className={cn(
          "group inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full py-0.5 pl-2",
          singleRun ? "pr-0.5" : "pr-2",
          "transition-colors hover:text-foreground",
        )}
        title={title}
        aria-label={title}
      >
        <span className="relative flex size-1.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400/40 opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-sky-400/90" />
        </span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronRight
          className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
          aria-hidden
        />
      </Link>
      {singleRun ? (
        <button
          type="button"
          onClick={() => void cancelRun(singleRun.id)}
          disabled={cancellingId === singleRun.id}
          className="mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          aria-label={t("agents.cancelRun")}
          title={t("agents.cancelRun")}
        >
          {cancellingId === singleRun.id ? (
            <span className="size-2.5 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <StopCircle className="size-3" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
