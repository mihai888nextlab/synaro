"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDown,
  Figma,
  HelpCircleIcon,
  ImageIcon,
  LoaderIcon,
  Mic,
  MonitorIcon,
  Paperclip,
  Plus,
  SendIcon,
  Sparkles,
  UserIcon,
  XIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiFileChangeCardList } from "@/components/ui/ai-file-change-card";
import { TaskLivePreview, TypewriterMarkdown } from "@/components/ui/ai-task-live-preview";
import { SpeechWaveform } from "@/components/ui/speech-waveform";
import { SynaroAssistantAvatar } from "@/components/ui/synaro-logo";
import { canUseMicrophone, supportsSpeechRecognition } from "@/lib/speech/capabilities";
import { useMicrophoneLevels } from "@/lib/speech/use-microphone-levels";
import { useSpeechInput } from "@/lib/speech/use-speech-input";
import { isGitOnlyWorkflowPrompt } from "@/lib/git-workflow-prompt";
import { cn } from "@/lib/utils";
import { useAiBackgroundTask } from "@/components/ui/ai-background-task";

type TaskStatus = "PENDING" | "ANALYZING" | "GENERATING" | "APPLYING" | "DONE" | "FAILED";

type TaskGitResult = {
  action?: string;
  branch?: string;
  commitSha?: string | null;
  remoteUrl?: string;
  htmlUrl?: string;
  noChanges?: boolean;
};

type TaskResult = {
  summary: string;
  changes: { path: string; content: string; previousContent?: string | null }[];
  git?: TaskGitResult;
};

type RemoteTask = {
  id: string;
  status: TaskStatus;
  progress?: string | null;
  result?: TaskResult | null;
  errorMessage?: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** When set, this assistant message is a clarification prompt — not a task result. */
  questions?: string[];
  taskId?: string;
  taskStatus?: TaskStatus;
  taskProgress?: string | null;
  taskResult?: TaskResult | null;
  taskError?: string | null;
  /** Progress lines shown in the live preview while the task runs. */
  activityLog?: string[];
  /** When true, skip typewriter playback (e.g. restored from localStorage). */
  playbackComplete?: boolean;
};

type CommandSuggestion = {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
};

type PendingClarification = {
  originalPrompt: string;
  questions: string[];
};

function useAutoResizeTextarea(minHeight: number, maxHeight = 200) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  React.useEffect(() => {
    adjustHeight(true);
  }, [adjustHeight]);

  React.useEffect(() => {
    const onResize = () => adjustHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

function TypingDots() {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="h-1.5 w-1.5 rounded-full bg-current"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ProgressBar() {
  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
      <motion.div
        className="h-full rounded-full bg-primary/60"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function MessageBubble({
  message,
  onPlaybackComplete,
}: {
  message: Message;
  onPlaybackComplete?: (messageId: string) => void;
}) {
  const isUser = message.role === "user";
  const isClarification = Boolean(message.questions && message.questions.length > 0);
  const isRunning =
    message.taskStatus &&
    message.taskStatus !== "DONE" &&
    message.taskStatus !== "FAILED";
  const isDone = message.taskStatus === "DONE";
  const isFailed = message.taskStatus === "FAILED";
  const shouldAnimateReply =
    !isUser && !message.playbackComplete && (isDone || isFailed);
  const activeFromLog =
    message.activityLog && message.activityLog.length > 0
      ? message.activityLog[message.activityLog.length - 1]
      : null;

  const activeLine =
    activeFromLog && activeFromLog.length > 0
      ? activeFromLog
      : message.taskProgress?.trim() ||
          (message.taskStatus ? statusLabel(message.taskStatus) : "Working…");

  const hasActivityLog = (message.activityLog?.length ?? 0) > 0;
  const showActivityToggle = (isDone || isFailed) && hasActivityLog;
  const [activityLogOpen, setActivityLogOpen] = React.useState(false);

  const gitFooter =
    isDone &&
    message.taskResult &&
    (message.taskResult.git?.htmlUrl ||
      (message.taskResult.git?.branch && !message.taskResult.git.noChanges));

  const bubbleClassName = cn(
    "rounded-2xl px-4 py-3 text-sm leading-relaxed max-xl:px-3 max-xl:py-2.5 max-xl:text-[0.8125rem]",
    isUser
      ? "bg-foreground text-background"
      : isFailed
        ? "border border-destructive/30 bg-destructive/5 text-foreground"
        : isClarification
          ? "border border-primary/30 bg-primary/5 text-foreground"
          : "border border-border/70 bg-card text-foreground",
    showActivityToggle &&
      "w-full cursor-pointer text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  );

  const taskReplyContent =
    (isDone || isFailed) && message.content ? (
      <>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TypewriterMarkdown
              text={message.content}
              enabled={shouldAnimateReply}
              onComplete={() => onPlaybackComplete?.(message.id)}
            />
          </div>
          {showActivityToggle ? (
            <ChevronDown
              className={cn(
                "mb-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                activityLogOpen && "rotate-180",
              )}
              aria-hidden
            />
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {activityLogOpen && hasActivityLog ? (
            <motion.div
              key="activity-log"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-3 max-h-40 space-y-0.5 overflow-y-auto border-t border-border/50 pt-3 font-mono text-[0.65rem] leading-relaxed text-muted-foreground/90 sm:text-xs">
                {message.activityLog!.map((line, i) => (
                  <p key={`${i}-${line.slice(0, 32)}`}>
                    <span className="text-primary/40">› </span>
                    {line}
                  </p>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    ) : null;

  return (
    <motion.div
      className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!isUser && <SynaroAssistantAvatar />}

      <div
        className={cn(
          "max-w-[80%] space-y-2 max-xl:max-w-[min(100%,20rem)]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Main bubble — whole card toggles activity log when applicable */}
        {showActivityToggle && taskReplyContent ? (
          <button
            type="button"
            onClick={() => setActivityLogOpen((open) => !open)}
            aria-expanded={activityLogOpen}
            aria-label={activityLogOpen ? "Hide activity log" : "Show activity log"}
            className={bubbleClassName}
          >
            {taskReplyContent}
          </button>
        ) : (
          <div className={bubbleClassName}>
            {isClarification ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <HelpCircleIcon className="h-4 w-4 text-primary" />
                  Before I start, a few quick questions:
                </div>
                <ol className="space-y-2 pl-1">
                  {message.questions!.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="shrink-0 font-mono text-xs font-medium text-primary/70 mt-0.5">
                        {i + 1}.
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground/70 italic">
                  Answer below and press Enter — or press Enter to skip and generate now.
                </p>
              </div>
            ) : isRunning ? (
              <p className="text-muted-foreground">Working on your request…</p>
            ) : taskReplyContent ? (
              taskReplyContent
            ) : (
              message.content
            )}
          </div>
        )}

        {isRunning && message.activityLog && message.activityLog.length > 0 ? (
          <div className="space-y-2">
            <TaskLivePreview
              activityLog={message.activityLog ?? []}
              activeLine={activeLine}
              animate={!message.playbackComplete}
            />
            <ProgressBar />
          </div>
        ) : null}

        {isDone && message.taskResult && message.taskResult.changes.length > 0 ? (
          <AiFileChangeCardList
            changes={message.taskResult.changes}
            animate={!message.playbackComplete}
          />
        ) : null}

        {gitFooter && (message.playbackComplete || !shouldAnimateReply) ? (
          <motion.div
            className="space-y-1.5 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {message.taskResult?.git?.htmlUrl ? (
              <p className="text-muted-foreground">
                Repository:{" "}
                <a
                  href={message.taskResult.git.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {message.taskResult.git.htmlUrl.replace(/^https:\/\//, "")}
                </a>
              </p>
            ) : null}
            {message.taskResult?.git?.branch && !message.taskResult.git.noChanges ? (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-green-500" />
                Pushed to{" "}
                <span className="font-mono text-foreground">{message.taskResult.git.branch}</span>
                {message.taskResult.git.commitSha ? (
                  <span className="font-mono">({message.taskResult.git.commitSha.slice(0, 7)})</span>
                ) : null}
              </p>
            ) : null}
          </motion.div>
        ) : null}

        {isFailed && (
          <div className="flex items-center gap-1.5 text-xs text-destructive/90">
            <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Task failed</span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "PENDING": return "Starting…";
    case "ANALYZING": return "Analyzing repository…";
    case "GENERATING": return "Generating code…";
    case "APPLYING": return "Applying changes…";
    case "DONE": return "Done";
    case "FAILED": return "Failed";
  }
}

function thinkingForStatus(status: TaskStatus): string | null {
  switch (status) {
    case "PENDING":
      return "Thinking — preparing your task…";
    case "ANALYZING":
      return "Thinking — scanning the repo and choosing files to read…";
    case "GENERATING":
      return "Thinking — drafting code changes for your request…";
    case "APPLYING":
      return "Thinking — writing files into your workspace…";
    default:
      return null;
  }
}

function appendActivityLine(log: string[], line: string, max = 16): string[] {
  const trimmed = line.trim();
  if (!trimmed) return log;
  if (log[log.length - 1] === trimmed) return log;
  return [...log, trimmed].slice(-max);
}

function buildActivityLog(
  prev: string[] | undefined,
  status: TaskStatus,
  progress: string | null | undefined,
  prevStatus?: TaskStatus,
): string[] {
  let log = prev ?? [];
  if (status !== prevStatus) {
    const thinking = thinkingForStatus(status);
    if (thinking) log = appendActivityLine(log, thinking);
  }
  if (progress?.trim()) {
    log = appendActivityLine(log, progress.trim());
  } else if (status !== prevStatus) {
    log = appendActivityLine(log, statusLabel(status));
  }
  return log;
}

export function AnimatedAIChat({
  className,
  projectId,
  projectSlug,
}: {
  className?: string;
  projectId?: string;
  projectSlug?: string;
}) {
  const storageKey = projectId ? `synaro:chat:${projectId}` : null;
  const { setActiveTask } = useAiBackgroundTask();

  const [value, setValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAsking, setIsAsking] = React.useState(false);
  const [pendingClarification, setPendingClarification] = React.useState<PendingClarification | null>(null);
  const [activeSuggestion, setActiveSuggestion] = React.useState<number>(-1);
  const paletteRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [compactInput, setCompactInput] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const sync = () => setCompactInput(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(compactInput ? 36 : 40, compactInput ? 120 : 180);

  React.useEffect(() => {
    adjustHeight(true);
  }, [compactInput, adjustHeight]);

  // Restore persisted messages after hydration
  React.useEffect(() => {
    if (!projectId) return;
    try {
      const saved = localStorage.getItem(`synaro:chat:${projectId}`);
      if (saved) {
        const restored = JSON.parse(saved) as Message[];
        setMessages(restored.map((m) => ({ ...m, playbackComplete: true })));
        // If there's an in-flight task, resume polling immediately.
        const running = [...restored]
          .reverse()
          .find(
            (m) =>
              typeof m.taskId === "string" &&
              m.taskId.length > 0 &&
              m.taskStatus &&
              m.taskStatus !== "DONE" &&
              m.taskStatus !== "FAILED",
          );
        if (running?.taskId && running.id) {
          setIsSubmitting(true);
          pollTask(running.taskId, running.id);
          setActiveTask({
            projectId,
            projectSlug: projectSlug ?? null,
            taskId: running.taskId,
            status: running.taskStatus,
            progress: running.taskProgress ?? null,
          });
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist chat history (skip in-flight tasks)
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      // Persist everything (including in-flight tasks) so switching tabs/pages is seamless.
      // Keep the payload small by dropping large transient fields for older messages.
      const toSave = messages.slice(-100).map((m, idx, arr) => {
        const isRecent = idx >= Math.max(0, arr.length - 6);
        if (isRecent) return m;
        return {
          ...m,
          // activity log can get large; keep only the tail for older messages
          activityLog: m.activityLog ? m.activityLog.slice(-12) : undefined,
        };
      });
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch {}
  }, [messages, storageKey]);

  const commandSuggestions: CommandSuggestion[] = React.useMemo(
    () => [
      {
        icon: <ImageIcon className="h-4 w-4" />,
        label: "Clone UI",
        description: "Generate a UI from a screenshot",
        prefix: "/clone",
      },
      {
        icon: <Figma className="h-4 w-4" />,
        label: "Import Figma",
        description: "Import a design from Figma",
        prefix: "/figma",
      },
      {
        icon: <MonitorIcon className="h-4 w-4" />,
        label: "Create Page",
        description: "Generate a new page scaffold",
        prefix: "/page",
      },
      {
        icon: <Sparkles className="h-4 w-4" />,
        label: "Improve",
        description: "Improve existing UI design",
        prefix: "/improve",
      },
    ],
    [],
  );

  const showCommandPalette = value.startsWith("/") && !value.includes(" ");
  const matchingSuggestionIndex = React.useMemo(() => {
    if (!showCommandPalette) return -1;
    return commandSuggestions.findIndex((cmd) => cmd.prefix.startsWith(value));
  }, [commandSuggestions, showCommandPalette, value]);

  const highlightedSuggestionIndex =
    activeSuggestion >= 0 ? activeSuggestion : matchingSuggestionIndex;

  React.useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (paletteRef.current && paletteRef.current.contains(target)) return;
      setActiveSuggestion(-1);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const stopPolling = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => stopPolling(), [stopPolling]);

  const markPlaybackComplete = React.useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, playbackComplete: true } : m)),
    );
  }, []);

  const pollTask = React.useCallback(
    (taskId: string, messageId: string) => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        void (async () => {
          try {
            const res = await fetch(`/api/ai-tasks/${encodeURIComponent(taskId)}`);
            if (!res.ok) return;
            const task = (await res.json()) as RemoteTask;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m;
                const activityLog = buildActivityLog(
                  m.activityLog,
                  task.status,
                  task.progress,
                  m.taskStatus,
                );
                const isTerminal = task.status === "DONE" || task.status === "FAILED";
                return {
                  ...m,
                  taskStatus: task.status,
                  taskProgress: task.progress ?? null,
                  taskResult: task.result ?? null,
                  taskError: task.errorMessage ?? null,
                  activityLog,
                  content:
                    task.status === "DONE" && task.result?.summary
                      ? task.result.summary
                      : task.status === "FAILED"
                        ? task.errorMessage ?? "Task failed"
                        : m.content,
                  playbackComplete: isTerminal ? false : m.playbackComplete,
                };
              }),
            );
            if (task.status !== "DONE" && task.status !== "FAILED") {
              setActiveTask({
                projectId: projectId ?? "",
                projectSlug: projectSlug ?? null,
                taskId: task.id,
                status: task.status,
                progress: task.progress ?? null,
              });
            }
            if (task.status === "DONE" || task.status === "FAILED") {
              stopPolling();
              setIsSubmitting(false);
              setActiveTask(null);
            }
          } catch {
            /* ignore transient errors */
          }
        })();
      }, 1200);
    },
    [projectId, projectSlug, setActiveTask, stopPolling],
  );

  // If the global task pill says we have a running task for this project, but the chat
  // has no running message (e.g. localStorage got cleared), recreate and resume polling.
  const { activeTask } = useAiBackgroundTask();
  React.useEffect(() => {
    if (!projectId) return;
    if (!activeTask?.taskId) return;
    if (activeTask.projectId !== projectId) return;
    if (!activeTask.status || activeTask.status === "DONE" || activeTask.status === "FAILED") return;

    const hasRunningMessage = messages.some(
      (m) =>
        m.taskId === activeTask.taskId &&
        m.taskStatus &&
        m.taskStatus !== "DONE" &&
        m.taskStatus !== "FAILED",
    );
    if (hasRunningMessage) return;

    const asstMsgId = `asst-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: asstMsgId,
        role: "assistant",
        content: "Working on your request…",
        taskId: activeTask.taskId,
        taskStatus: activeTask.status,
        taskProgress: activeTask.progress ?? null,
        activityLog: activeTask.progress ? [activeTask.progress] : [],
        playbackComplete: true,
      },
    ]);
    setIsSubmitting(true);
    pollTask(activeTask.taskId, asstMsgId);
  }, [activeTask, messages, pollTask, projectId]);

  /** Start the actual code generation task with a (possibly combined) prompt. */
  const submitGeneration = React.useCallback(
    async (prompt: string) => {
      if (!projectId) return;

      const asstMsgId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: asstMsgId,
          role: "assistant",
          content: "Working on your request…",
          taskStatus: "PENDING",
          taskProgress: "Starting…",
          activityLog: buildActivityLog([], "PENDING", "Starting…", undefined),
          playbackComplete: false,
        },
      ]);

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/ai-task`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          },
        );
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    content: "Task submission failed.",
                    taskStatus: "FAILED",
                    taskError: data.error ?? `Error ${res.status}`,
                    taskProgress: null,
                  }
                : m,
            ),
          );
          setIsSubmitting(false);
          return;
        }
        const task = (await res.json()) as RemoteTask;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId ? { ...m, taskId: task.id, taskStatus: task.status } : m,
          ),
        );
        setActiveTask({
          projectId,
          projectSlug: projectSlug ?? null,
          taskId: task.id,
          status: task.status,
          progress: task.progress ?? null,
        });
        pollTask(task.id, asstMsgId);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? {
                  ...m,
                  content: "Network error — could not reach the AI service.",
                  taskStatus: "FAILED",
                  taskProgress: null,
                }
              : m,
          ),
        );
        setIsSubmitting(false);
      }
    },
    [projectId, pollTask],
  );

  const handleSend = React.useCallback(async (promptOverride?: string) => {
    const prompt = (promptOverride ?? value).trim();
    if (!prompt || isSubmitting || isAsking) return;

    setValue("");
    adjustHeight(true);

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: prompt }]);

    if (!projectId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: "No project is connected. Open a project workspace to use AI coding assistance.",
        },
      ]);
      return;
    }

    setIsSubmitting(true);

    // If the user is answering a clarification, combine and generate
    if (pendingClarification) {
      const combined =
        pendingClarification.originalPrompt +
        "\n\nAdditional context from the user:\n" +
        prompt;
      setPendingClarification(null);
      await submitGeneration(combined);
      return;
    }

    // Git commit/push/create-repo — run immediately (clarify is for new feature builds only)
    if (isGitOnlyWorkflowPrompt(prompt)) {
      await submitGeneration(prompt);
      return;
    }

    // Otherwise, ask clarifying questions first
    setIsAsking(true);

    try {
      const clarifyRes = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/ai-clarify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        },
      );
      const clarifyData = clarifyRes.ok
        ? ((await clarifyRes.json()) as { questions?: string[] })
        : { questions: [] };

      const questions = clarifyData.questions ?? [];

      if (questions.length === 0) {
        // No questions — generate directly
        setIsAsking(false);
        await submitGeneration(prompt);
        return;
      }

      // Show questions and wait for user's answer
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: "clarification",
          questions,
        },
      ]);
      setPendingClarification({ originalPrompt: prompt, questions });
      setIsAsking(false);
      setIsSubmitting(false);
    } catch {
      // On error, fall back to direct generation
      setIsAsking(false);
      await submitGeneration(prompt);
    }
  }, [value, isSubmitting, isAsking, projectId, pendingClarification, adjustHeight, submitGeneration]);

  const handleSendRef = React.useRef(handleSend);
  handleSendRef.current = handleSend;

  const isBusy = isSubmitting || isAsking;

  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setVoiceSupported(supportsSpeechRecognition() && canUseMicrophone());
  }, []);

  const { isListening, toggle: toggleVoice, stop: stopVoice } = useSpeechInput({
    disabled: isBusy || !voiceSupported,
    onInterim: (text) => {
      setValue(text);
      adjustHeight();
    },
    onUtteranceEnd: (text) => {
      if (!text.trim()) return;
      void handleSendRef.current(text);
    },
    onError: (msg) => {
      setVoiceError(msg);
      window.setTimeout(() => setVoiceError(null), 4000);
    },
  });

  const micLevels = useMicrophoneLevels(isListening);

  React.useEffect(() => {
    if (isBusy && isListening) stopVoice();
  }, [isBusy, isListening, stopVoice]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          (prev >= 0 ? prev : matchingSuggestionIndex) < commandSuggestions.length - 1
            ? (prev >= 0 ? prev : matchingSuggestionIndex) + 1
            : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          (prev >= 0 ? prev : matchingSuggestionIndex) > 0
            ? (prev >= 0 ? prev : matchingSuggestionIndex) - 1
            : commandSuggestions.length - 1,
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (highlightedSuggestionIndex >= 0) {
          const cmd = commandSuggestions[highlightedSuggestionIndex];
          setValue(`${cmd.prefix} `);
          setActiveSuggestion(-1);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveSuggestion(-1);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const pickSuggestion = (idx: number) => {
    setValue(`${commandSuggestions[idx].prefix} `);
    setActiveSuggestion(-1);
  };

  const hasMessages = messages.length > 0;
  const placeholder = pendingClarification
    ? "Answer the questions above, or press Enter to skip…"
    : "Ask Synaro a question…";

  return (
    <div className={cn("lab-bg relative flex h-full w-full flex-col overflow-hidden", className)}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      {/* Scrollable chat — messages extend under the floating composer */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-4 sm:px-6 sm:pt-6",
          "pb-28 sm:pb-32",
          !hasMessages && "justify-center",
        )}
      >
        {!hasMessages && (
          <motion.div
            className="w-full space-y-6 max-xl:gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl max-xl:text-xl max-xl:sm:text-xl">
                Let&apos;s build your idea!
              </h2>
              <div className="mx-auto mt-2 h-px w-56 max-w-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent max-xl:w-40" />
              <p className="mt-3 hidden text-sm text-muted-foreground xl:block">
                Describe what you want to build — I&apos;ll ask a few questions, then generate it.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 max-xl:gap-1.5">
              {commandSuggestions.map((s, idx) => (
                <motion.button
                  key={s.prefix}
                  onClick={() => pickSuggestion(idx)}
                  className="relative inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/40 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground max-xl:gap-1.5 max-xl:px-2.5 max-xl:py-1.5 max-xl:text-xs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                >
                  {s.icon}
                  <span>{s.label}</span>
                  <span className="pointer-events-none absolute inset-0 rounded-xl border border-border/30" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {hasMessages && (
          <div className="flex flex-col space-y-4 max-xl:space-y-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onPlaybackComplete={markPlaybackComplete}
              />
            ))}
            {isAsking && (
              <motion.div
                className="flex w-full gap-3 justify-start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SynaroAssistantAvatar />
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm text-muted-foreground">
                  <TypingDots />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-background via-background/90 to-transparent sm:h-32"
        aria-hidden
      />

      {/* Floating composer card overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3 sm:px-6 sm:pb-4">
        <motion.div
          data-onboarding="ai-composer"
          className={cn(
            "pointer-events-auto relative mx-auto w-full max-w-3xl overflow-visible rounded-2xl border border-border/70 bg-card/95 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl max-xl:max-w-none",
          )}
          initial={{ scale: 0.99, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AnimatePresence>
            {showCommandPalette && (
              <motion.div
                ref={paletteRef}
                className="absolute bottom-full left-3 z-50 mb-2 w-[min(100%,20rem)] overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:left-4"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14 }}
              >
                <div className="p-2">
                  {commandSuggestions.map((s, idx) => (
                    <button
                      key={s.prefix}
                      type="button"
                      onClick={() => pickSuggestion(idx)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
                        highlightedSuggestionIndex === idx
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground">
                        {s.icon}
                      </div>
                      <div className="font-medium">{s.label}</div>
                      <div className="ml-1 text-xs text-muted-foreground">{s.prefix}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isListening ? (
              <motion.div
                className="border-b border-border/70 bg-primary/5 px-3 py-2 xl:px-4 xl:py-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <SpeechWaveform levels={micLevels} />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Listening… stops after 3s of silence (tap mic to cancel)
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {voiceError ? (
            <p className="border-b border-border/70 px-4 py-2 text-center text-xs text-destructive">{voiceError}</p>
          ) : null}

          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                className="border-b border-border/70 px-3 py-2 sm:px-4 sm:py-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, idx) => (
                    <motion.div
                      key={`${file.name}-${file.lastModified}-${idx}`}
                      className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <span className="max-w-[240px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove attachment"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {pendingClarification && !isSubmitting ? (
            <div className="flex justify-end border-b border-border/70 px-3 py-2 sm:px-4">
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  const prompt = pendingClarification.originalPrompt;
                  setPendingClarification(null);
                  setIsSubmitting(true);
                  void submitGeneration(prompt);
                }}
                className="inline-flex items-center rounded-lg border border-border/70 bg-card/80 px-2.5 py-1 text-[0.6875rem] text-muted-foreground transition hover:bg-muted hover:text-foreground sm:text-xs"
              >
                Skip questions
              </motion.button>
            </div>
          ) : null}

          <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center self-stretch">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  const next = e.target.value;
                  setValue(next);
                  if (!(next.startsWith("/") && !next.includes(" "))) setActiveSuggestion(-1);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening…" : placeholder}
                disabled={isBusy || isListening}
                rows={1}
                className={cn(
                  "block w-full min-h-9 resize-none bg-transparent py-0 text-sm leading-9 text-foreground sm:min-h-10 sm:leading-10",
                  "placeholder:text-muted-foreground/60 focus:outline-none",
                  isBusy && "cursor-not-allowed opacity-50",
                )}
                style={{ overflow: "hidden" }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {voiceSupported ? (
                  <motion.button
                    type="button"
                    onClick={toggleVoice}
                    disabled={isBusy}
                    whileTap={{ scale: 0.94 }}
                    className={cn(
                      "relative inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border/70 bg-card/80 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:h-10 sm:w-10",
                      isListening && "border-primary/50 bg-primary/10 text-primary",
                      isBusy && "pointer-events-none opacity-50",
                    )}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    aria-pressed={isListening}
                  >
                    <Mic className={cn("h-4 w-4", isListening && "animate-pulse")} />
                  </motion.button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isListening}
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border/70 bg-card/80 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50 sm:h-10 sm:w-10",
                        "rounded-[28%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        showCommandPalette && "bg-muted text-foreground",
                      )}
                      aria-label="More actions"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="w-56 rounded-xl border-border/70 p-1.5 shadow-lg"
                  >
                    <DropdownMenuItem
                      disabled={isListening}
                      className="gap-2 rounded-lg py-2"
                      onSelect={() => openFilePicker()}
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Attach file</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Commands
                    </DropdownMenuLabel>
                    {commandSuggestions.map((s, idx) => (
                      <DropdownMenuItem
                        key={s.prefix}
                        className="gap-2 rounded-lg py-2"
                        onSelect={() => pickSuggestion(idx)}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground">
                          {s.icon}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-medium leading-none">{s.label}</span>
                          <span className="truncate text-xs text-muted-foreground">{s.description}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <motion.button
                  type="button"
                  onClick={() => void handleSend(undefined)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isBusy || !value.trim()}
                  aria-label={
                    isAsking ? "Thinking" : isSubmitting ? "Building" : "Send message"
                  }
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-[28%] transition",
                    "h-9 w-9 sm:h-10 sm:w-10 xl:h-10 xl:w-auto xl:min-w-[5.5rem] xl:rounded-2xl xl:gap-2 xl:px-4 xl:py-2 xl:text-sm xl:font-medium",
                    value.trim() && !isBusy
                      ? "bg-foreground text-background shadow-sm shadow-black/5"
                      : "border border-border/70 bg-muted text-muted-foreground",
                  )}
                >
                  {isAsking ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : isSubmitting ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendIcon className="h-4 w-4" />
                  )}
                  <span className="hidden xl:inline">
                    {isAsking ? "Thinking…" : isSubmitting ? "Building…" : "Send"}
                  </span>
                </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
