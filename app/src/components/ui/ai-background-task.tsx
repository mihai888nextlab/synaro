"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { showBrowserNotification, useNotifications } from "@/components/ui/notifications";

type TaskStatus = "PENDING" | "ANALYZING" | "GENERATING" | "APPLYING" | "DONE" | "FAILED";

type RemoteTask = {
  id: string;
  status: TaskStatus;
  progress?: string | null;
  errorMessage?: string | null;
  result?: { summary?: string | null } | unknown | null;
  projectId?: string | null;
  projectSlug?: string | null;
};

type ActiveAiTask = {
  projectId: string;
  projectSlug?: string | null;
  taskId: string;
  status?: TaskStatus;
  progress?: string | null;
  updatedAtMs?: number;
};

type Ctx = {
  activeTask: ActiveAiTask | null;
  setActiveTask: (task: ActiveAiTask | null) => void;
};

const STORAGE_KEY = "synaro:ai:activeTask";

const AiBackgroundTaskContext = React.createContext<Ctx | null>(null);

function isTerminal(status: TaskStatus | undefined) {
  return status === "DONE" || status === "FAILED";
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
  const lastNotifiedTaskIdRef = React.useRef<string | null>(null);
  const { push } = useNotifications();

  const setActiveTask = React.useCallback((task: ActiveAiTask | null) => {
    setActiveTaskState(task);
    storeActiveTask(task);
  }, []);

  // Restore on hydration
  React.useEffect(() => {
    const stored = loadStoredActiveTask();
    if (stored) setActiveTaskState(stored);
  }, []);

  // If we have a stored projectId but not status, try to infer by asking the tasks list endpoint once.
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
        const data = (await res.json()) as { tasks?: RemoteTask[] } | RemoteTask[] | unknown;
        if (cancelled) return;

        const tasks = Array.isArray(data)
          ? (data as RemoteTask[])
          : (data as { tasks?: RemoteTask[] }).tasks ?? [];

        const running = tasks.find((t) => t.id === activeTask.taskId && !isTerminal(t.status));
        if (running) {
          const next: ActiveAiTask = {
            ...activeTask,
            status: running.status,
            progress: running.progress ?? null,
            updatedAtMs: Date.now(),
          };
          setActiveTaskState(next);
          storeActiveTask(next);
        } else {
          // task no longer running
          setActiveTask(null);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTask, setActiveTask]);

  // Poll task status while it's running
  React.useEffect(() => {
    if (!activeTask?.taskId) return;
    if (isTerminal(activeTask.status)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/ai-tasks/${encodeURIComponent(activeTask.taskId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) setActiveTask(null);
          return;
        }
        const task = (await res.json()) as RemoteTask;
        if (cancelled) return;

        const next: ActiveAiTask = {
          projectId: activeTask.projectId,
          projectSlug: activeTask.projectSlug ?? null,
          taskId: task.id,
          status: task.status,
          progress: task.progress ?? null,
          updatedAtMs: Date.now(),
        };

        if (isTerminal(task.status)) {
          // Notify once per task
          if (lastNotifiedTaskIdRef.current !== task.id) {
            lastNotifiedTaskIdRef.current = task.id;
            const href =
              activeTask.projectSlug?.trim() ? `/projects/${encodeURIComponent(activeTask.projectSlug)}` : undefined;
            const title =
              task.status === "DONE" ? "AI finished your task" : "AI task failed";
            const description =
              task.status === "DONE"
                ? (typeof (task.result as any)?.summary === "string"
                    ? ((task.result as any).summary as string)
                    : activeTask.progress ?? undefined)
                : task.errorMessage ?? activeTask.progress ?? undefined;

            push({
              type: task.status === "DONE" ? "ai_task_done" : "ai_task_failed",
              title,
              description,
              href,
              meta: { taskId: task.id, projectId: activeTask.projectId },
            });

            showBrowserNotification(title, {
              body: description,
              tag: `synaro-ai-${task.id}`,
            });
          }
          setActiveTask(null);
        } else {
          setActiveTaskState(next);
          storeActiveTask(next);
        }
      } catch {
        // ignore transient errors
      }
    }

    void tick();
    timer = setInterval(() => void tick(), 1200);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [activeTask?.projectId, activeTask?.projectSlug, activeTask?.status, activeTask?.taskId, setActiveTask]);

  const ctx: Ctx = React.useMemo(() => ({ activeTask, setActiveTask }), [activeTask, setActiveTask]);

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

export function AiBackgroundTaskPill({ className }: { className?: string }) {
  const { activeTask } = useAiBackgroundTask();
  const router = useRouter();

  if (!activeTask || isTerminal(activeTask.status)) return null;

  const slug = activeTask.projectSlug?.trim();
  const href = slug ? `/projects/${encodeURIComponent(slug)}` : router.asPath;
  const label = activeTask.progress?.trim() || "AI is running…";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex max-w-[18rem] items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground shadow-sm shadow-black/5",
        "transition hover:bg-muted",
        className,
      )}
      title={label}
    >
      <span className="relative inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-3.5" />
        <Loader2 className="absolute -right-1 -top-1 size-3 animate-spin text-primary/70" />
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
      <span className="text-muted-foreground/70 transition group-hover:text-muted-foreground">
        View
      </span>
    </Link>
  );
}

