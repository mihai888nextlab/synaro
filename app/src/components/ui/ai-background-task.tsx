"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight } from "lucide-react";

import { taskPollFingerprint } from "@/lib/ai-task-message";
import type { AiRemoteTask, AiTaskStatus } from "@/lib/ai-task-types";
import { formatNotificationDescription } from "@/lib/notifications/format-notification-body";
import { cn } from "@/lib/utils";
import { showBrowserNotification, useNotifications, playNotificationSound } from "@/components/ui/notifications";
import { useTranslation } from "@/components/ui/locale-provider";

export type { AiRemoteTask, AiTaskStatus } from "@/lib/ai-task-types";

type ActiveAiTask = {
  projectId: string;
  projectSlug?: string | null;
  taskId: string;
  status?: AiTaskStatus;
  progress?: string | null;
  updatedAtMs?: number;
};

type Ctx = {
  activeTask: ActiveAiTask | null;
  setActiveTask: (task: ActiveAiTask | null) => void;
  /** Latest task payload from the shared poller (one request per interval). */
  polledTask: AiRemoteTask | null;
};

const STORAGE_KEY = "synaro:ai:activeTask";
const TASK_POLL_MS = 700;

const AiBackgroundTaskContext = React.createContext<Ctx | null>(null);

function isTerminal(status: AiTaskStatus | undefined) {
  return status === "DONE" || status === "FAILED" || status === "CANCELLED";
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadStoredActiveTask(): ActiveAiTask | null {
  return safeJsonParse<ActiveAiTask>(localStorage.getItem(STORAGE_KEY));
}

function storeActiveTask(task: ActiveAiTask | null) {
  try {
    if (!task) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(task));
  } catch {
    // ignore
  }
}

export function AiBackgroundTaskProvider({ children }: { children: React.ReactNode }) {
  const [activeTask, setActiveTaskState] = React.useState<ActiveAiTask | null>(null);
  const [polledTask, setPolledTask] = React.useState<AiRemoteTask | null>(null);
  const lastPollFingerprintRef = React.useRef<string | null>(null);
  const lastNotifiedTaskIdRef = React.useRef<string | null>(null);
  const { push } = useNotifications();
  const { t } = useTranslation();

  const setActiveTask = React.useCallback((task: ActiveAiTask | null) => {
    setActiveTaskState(task);
    storeActiveTask(task);
  }, []);

  React.useEffect(() => {
    const stored = loadStoredActiveTask();
    if (stored) setActiveTaskState(stored);
  }, []);

  React.useEffect(() => {
    if (!activeTask?.projectId) return;
    if (activeTask.status) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(activeTask.projectId)}/ai-task`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { tasks?: AiRemoteTask[] } | AiRemoteTask[] | unknown;
        if (cancelled) return;

        const tasks = Array.isArray(data)
          ? (data as AiRemoteTask[])
          : (data as { tasks?: AiRemoteTask[] }).tasks ?? [];

        const match = tasks.find((t) => t.id === activeTask.taskId);
        if (match && !isTerminal(match.status)) {
          const next: ActiveAiTask = {
            ...activeTask,
            status: match.status,
            progress: match.progress ?? null,
            updatedAtMs: Date.now(),
          };
          setActiveTaskState(next);
          storeActiveTask(next);
          return;
        }

        let terminal = match;
        if (!terminal) {
          const one = await fetch(`/api/ai-tasks/${encodeURIComponent(activeTask.taskId)}`, {
            cache: "no-store",
          });
          if (one.ok) terminal = (await one.json()) as AiRemoteTask;
        }

        if (terminal) {
          lastPollFingerprintRef.current = taskPollFingerprint(terminal);
          setPolledTask(terminal);
        }
        setActiveTask(null);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTask, setActiveTask]);

  const pollingTaskIdRef = React.useRef<string | null>(null);
  const activeTaskRef = React.useRef(activeTask);
  activeTaskRef.current = activeTask;

  React.useEffect(() => {
    if (!activeTask?.taskId) return;
    if (isTerminal(activeTask.status)) return;

    if (pollingTaskIdRef.current !== activeTask.taskId) {
      pollingTaskIdRef.current = activeTask.taskId;
      lastPollFingerprintRef.current = null;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      const current = activeTaskRef.current;
      if (!current?.taskId) return;
      try {
        const res = await fetch(`/api/ai-tasks/${encodeURIComponent(current.taskId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) setActiveTask(null);
          return;
        }
        const task = (await res.json()) as AiRemoteTask;
        if (cancelled) return;

        const fingerprint = taskPollFingerprint(task);
        if (isTerminal(task.status) || fingerprint !== lastPollFingerprintRef.current) {
          lastPollFingerprintRef.current = fingerprint;
          setPolledTask(task);
        }

        const next: ActiveAiTask = {
          projectId: current.projectId,
          projectSlug: current.projectSlug ?? null,
          taskId: task.id,
          status: task.status,
          progress: task.progress ?? null,
          updatedAtMs: Date.now(),
        };

        if (isTerminal(task.status)) {
          if (task.status !== "CANCELLED" && lastNotifiedTaskIdRef.current !== task.id) {
            lastNotifiedTaskIdRef.current = task.id;
            const href =
              current.projectSlug?.trim()
                ? `/projects/${encodeURIComponent(current.projectSlug)}`
                : undefined;
            const failed = task.status !== "DONE";
            const title = failed
              ? t("notifications.aiTaskFailed")
              : t("notifications.aiTaskComplete");
            const rawBody =
              task.status === "DONE"
                ? typeof (task.result as { summary?: string })?.summary === "string"
                  ? ((task.result as { summary: string }).summary)
                  : current.progress ?? undefined
                : task.errorMessage ?? current.progress ?? undefined;
            const description = formatNotificationDescription(rawBody, {
              failed,
              t: (key) => t(`notifications.${key}`),
            });

            push({
              type: failed ? "ai_task_failed" : "ai_task_done",
              title,
              description,
              href,
              meta: { taskId: task.id, projectId: current.projectId },
            });

            showBrowserNotification(title, {
              body: description,
              tag: `synaro-ai-${task.id}`,
            });
            playNotificationSound();
          }
          setActiveTask(null);
        } else if (
          current.status !== task.status ||
          current.progress !== (task.progress ?? null)
        ) {
          setActiveTaskState(next);
          storeActiveTask(next);
        }
      } catch {
        // ignore transient errors
      }
    }

    void tick();
    timer = setInterval(() => void tick(), TASK_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  // Poll uses activeTask field deps intentionally — full object would re-subscribe on every progress tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeTask identity is tracked via projectId/taskId/status fields
  }, [activeTask?.projectId, activeTask?.projectSlug, activeTask?.taskId, push, setActiveTask, t]);

  const ctx: Ctx = React.useMemo(
    () => ({ activeTask, setActiveTask, polledTask }),
    [activeTask, polledTask, setActiveTask],
  );

  return (
    <AiBackgroundTaskContext.Provider value={ctx}>{children}</AiBackgroundTaskContext.Provider>
  );
}

export function useAiBackgroundTask() {
  const ctx = React.useContext(AiBackgroundTaskContext);
  if (!ctx) {
    throw new Error("useAiBackgroundTask must be used within AiBackgroundTaskProvider");
  }
  return ctx;
}

function pillStatusLabel(
  progress: string | null | undefined,
  status: AiTaskStatus | undefined,
): string {
  const raw = progress?.trim();
  if (raw) {
    if (/writing your code/i.test(raw)) return "Writing";
    if (/drafting/i.test(raw)) return "Drafting";
    if (/reading|scanning/i.test(raw)) return "Reading";
    if (/analyzing|identifying/i.test(raw)) return "Analyzing";
    if (/applying|writing \d+ file/i.test(raw)) return "Applying";
    if (/verify|health|integrat|self-heal/i.test(raw)) return "Verifying";
    if (/github|commit|push/i.test(raw)) return "Syncing";
    if (/summariz/i.test(raw)) return "Summarizing";
    if (raw.length > 22) return `${raw.slice(0, 20)}…`;
    return raw.replace(/\.{3}$|…$/g, "");
  }
  switch (status) {
    case "ANALYZING":
      return "Analyzing";
    case "GENERATING":
      return "Generating";
    case "APPLYING":
      return "Applying";
    case "VERIFYING":
      return "Verifying";
    default:
      return "Running";
  }
}

export function AiBackgroundTaskPill({ className }: { className?: string }) {
  const { activeTask } = useAiBackgroundTask();
  const router = useRouter();

  if (!activeTask || isTerminal(activeTask.status)) return null;

  const slug = activeTask.projectSlug?.trim();
  const href = slug ? `/projects/${encodeURIComponent(slug)}` : router.asPath;
  const fullLabel = activeTask.progress?.trim() || "AI task in progress";
  const shortLabel = pillStatusLabel(activeTask.progress, activeTask.status);

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-7 max-w-[10rem] items-center gap-1.5 rounded-full",
        "border border-border/40 bg-muted/20 px-2.5",
        "text-xs leading-none text-muted-foreground",
        "transition-colors hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
        className,
      )}
      title={fullLabel}
      aria-label={`${fullLabel}. Open project chat.`}
    >
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-primary/80" />
      </span>
      <span className="min-w-0 truncate font-medium tracking-tight">{shortLabel}</span>
      <ChevronRight
        className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
        aria-hidden
      />
    </Link>
  );
}
