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
  MonitorIcon,
  Paperclip,
  PlayIcon,
  Plus,
  SendIcon,
  Sparkles,
  UserIcon,
  XIcon,
} from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
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
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { useWorkspaceChatPreview } from "@/components/ui/workspace-chat-preview";
import { isTerminalTaskStatus, resolveTaskAnswerContent } from "@/lib/ai-task-message";
import type { TaskResult } from "@/lib/ai-task-types";
import { SpeechWaveform } from "@/components/ui/speech-waveform";
import { SynaroAssistantAvatar } from "@/components/ui/synaro-logo";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { localeToBcp47 } from "@/lib/speech/locale-bcp47";
import { useMicrophoneLevels } from "@/lib/speech/use-microphone-levels";
import { useSpeechInput } from "@/lib/speech/use-speech-input";
import { isGitOnlyWorkflowPrompt } from "@/lib/git-workflow-prompt";
import { cn } from "@/lib/utils";
import { useAiBackgroundTask, type AiRemoteTask, type AiTaskStatus } from "@/components/ui/ai-background-task";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";

type TaskStatus = AiTaskStatus;

type RemoteTask = AiRemoteTask & { result?: TaskResult | null };

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

function wantsStrictClarification(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    p.includes("don't start") ||
    p.includes("do not start") ||
    p.includes("before you start") ||
    p.includes("until you understand") ||
    p.includes("ask clarifying") ||
    p.includes("clarifying questions") ||
    p.includes("make sure you understand")
  );
}

function isLikelyQuestion(prompt: string): boolean {
  const p = prompt.trim();
  if (!p) return false;
  const lower = p.toLowerCase();

  // Explicit instructions should not be treated as questions.
  const instructionStarters = [
    "add ",
    "create ",
    "implement ",
    "build ",
    "fix ",
    "update ",
    "modify ",
    "refactor ",
    "generate ",
    "remove ",
    "rename ",
    "make ",
  ];
  if (instructionStarters.some((s) => lower.startsWith(s))) return false;

  if (p.endsWith("?")) return true;

  const questionStarters = [
    "what ",
    "why ",
    "how ",
    "where ",
    "when ",
    "which ",
    "can you ",
    "could you ",
    "explain ",
    "tell me ",
    "summarize ",
    "describe ",
    "do we ",
    "does this ",
    "is there ",
  ];
  if (questionStarters.some((s) => lower.startsWith(s))) return true;

  if (lower.includes("what is this") || lower.includes("what's this")) return true;

  return false;
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

function ThinkingMessage() {
  const { t } = useTranslation();
  const phases = React.useMemo(
    () => [t("aiChat.thinkingRequest"), t("aiChat.readingCodebase"), t("aiChat.preparingQuestions")],
    [t],
  );
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % phases.length), 2000);
    return () => clearInterval(id);
  }, [phases.length]);
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <TypingDots />
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          {phases[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function useElapsedSeconds(running: boolean): string {
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    if (!running) { setSecs(0); return; }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MessageBubble({
  message,
  onOpenFile,
}: {
  message: Message;
  onPlaybackComplete?: (messageId: string) => void;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const isClarification = Boolean(message.questions && message.questions.length > 0);
  const isRunning =
    message.taskStatus &&
    message.taskStatus !== "DONE" &&
    message.taskStatus !== "FAILED";
  const isDone = message.taskStatus === "DONE";
  const isFailed = message.taskStatus === "FAILED";
  const hasAnswerText = Boolean(message.content?.trim());
  const activeFromLog =
    message.activityLog && message.activityLog.length > 0
      ? message.activityLog[message.activityLog.length - 1]
      : null;

  const activeLine =
    activeFromLog && activeFromLog.length > 0
      ? activeFromLog
      : message.taskProgress?.trim() ||
          (message.taskStatus ? statusLabel(message.taskStatus, t) : t("aiChat.working"));

  const hasActivityLog = (message.activityLog?.length ?? 0) > 0;
  const showActivityToggle = (isDone || isFailed) && hasActivityLog;
  const [activityLogOpen, setActivityLogOpen] = React.useState(false);
  const elapsed = useElapsedSeconds(!!isRunning);

  const gitFooter =
    isDone &&
    message.taskResult &&
    (message.taskResult.git?.htmlUrl ||
      (message.taskResult.git?.branch && !message.taskResult.git.noChanges));

  const miniMeta =
    isDone && message.taskResult?.meta
      ? {
          exploredFiles: Math.max(0, message.taskResult.meta.exploredFiles ?? 0),
          aiSteps: Math.max(0, message.taskResult.meta.aiSteps ?? 0),
        }
      : null;

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

  const answerBody = hasAnswerText ? (
    isRunning ? (
      <TypewriterMarkdown
        text={message.content!}
        enabled
        streaming
        className="break-words"
      />
    ) : (
      <MarkdownLite text={message.content!} onOpenFile={onOpenFile} />
    )
  ) : null;

  const taskReplyContent = hasAnswerText && (isDone || isFailed);

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
        {/* Main bubble — stable wrapper so typewriter state survives running → done */}
        <div
          className={bubbleClassName}
          {...(showActivityToggle && taskReplyContent
            ? {
                role: "button" as const,
                tabIndex: 0,
                onClick: () => setActivityLogOpen((open) => !open),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActivityLogOpen((open) => !open);
                  }
                },
                "aria-expanded": activityLogOpen,
                "aria-label": activityLogOpen ? t("aiChat.hideActivityLog") : t("aiChat.showActivityLog"),
              }
            : {})}
        >
          {isClarification ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <HelpCircleIcon className="h-4 w-4 text-primary" />
                {t("aiChat.clarifyingIntro")}
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
                {t("aiChat.clarifyingHint")}
              </p>
            </div>
          ) : hasAnswerText && (isRunning || isDone || isFailed) ? (
            <>
              {miniMeta ? (
                <div className="mb-2 text-[0.7rem] leading-none text-muted-foreground">
                  {t("aiChat.exploredMeta", {
                    files: miniMeta.exploredFiles,
                    filesLabel:
                      miniMeta.exploredFiles === 1
                        ? t("aiChat.exploredFileOne")
                        : t("aiChat.exploredFileMany"),
                    steps: miniMeta.aiSteps,
                    stepsLabel:
                      miniMeta.aiSteps === 1
                        ? t("aiChat.exploredStepOne")
                        : t("aiChat.exploredStepMany"),
                  })}
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">{answerBody}</div>
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
              {isRunning ? (
                <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t("aiChat.writing")}</span>
                  <span className="font-mono tabular-nums opacity-50">{elapsed}</span>
                </p>
              ) : null}
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
          ) : isRunning ? (
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <p>{t("aiChat.workingOnRequest")}</p>
              <span className="font-mono text-xs tabular-nums opacity-50">{elapsed}</span>
            </div>
          ) : (
            message.content
          )}
        </div>

        {isRunning && message.activityLog && message.activityLog.length > 0 ? (
          <div className="space-y-2">
            <TaskLivePreview
              activityLog={message.activityLog ?? []}
              activeLine={activeLine}
              animate={false}
            />
            <ProgressBar />
          </div>
        ) : null}

        {isDone && message.taskResult && message.taskResult.changes.length > 0 ? (
          <AiFileChangeCardList
            changes={message.taskResult.changes}
            animate={false}
            onOpenFile={onOpenFile}
          />
        ) : null}

        {gitFooter && message.playbackComplete ? (
          <motion.div
            className="space-y-1.5 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {message.taskResult?.git?.htmlUrl ? (
              <p className="text-muted-foreground">
                {t("aiChat.repository")}{" "}
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
                {t("aiChat.pushedTo")}{" "}
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
            <span>{t("aiChat.taskFailed")}</span>
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

function statusLabel(status: TaskStatus, t: (key: string) => string): string {
  switch (status) {
    case "PENDING": return t("aiChat.statusStarting");
    case "ANALYZING": return t("aiChat.statusAnalyzing");
    case "GENERATING": return t("aiChat.statusGenerating");
    case "APPLYING": return t("aiChat.statusApplying");
    case "DONE": return t("aiChat.statusDone");
    case "FAILED": return t("aiChat.statusFailed");
  }
}

function thinkingForStatus(status: TaskStatus, t: (key: string) => string): string | null {
  switch (status) {
    case "PENDING":
      return t("aiChat.thinkingPending");
    case "ANALYZING":
      return t("aiChat.thinkingAnalyzing");
    case "GENERATING":
      return t("aiChat.thinkingGenerating");
    case "APPLYING":
      return t("aiChat.thinkingApplying");
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
  prevStatus: TaskStatus | undefined,
  t: (key: string) => string,
): string[] {
  let log = prev ?? [];
  if (status !== prevStatus) {
    const thinking = thinkingForStatus(status, t);
    if (thinking) log = appendActivityLine(log, thinking);
  }
  if (progress?.trim()) {
    log = appendActivityLine(log, progress.trim());
  } else if (status !== prevStatus) {
    log = appendActivityLine(log, statusLabel(status, t));
  }
  return log;
}

function mergeMessageWithRemoteTask(m: Message, task: RemoteTask, t: (key: string) => string): Message {
  const activityLog = buildActivityLog(
    m.activityLog,
    task.status,
    task.progress,
    m.taskStatus,
    t,
  );
  const isTerminal = isTerminalTaskStatus(task.status);
  const result = task.result as TaskResult | null | undefined;
  const content = resolveTaskAnswerContent(task, m.content ?? "") ?? m.content;

  return {
    ...m,
    taskStatus: task.status,
    taskProgress: task.progress ?? null,
    taskResult: result ?? null,
    taskError: task.errorMessage ?? null,
    activityLog,
    content: content ?? m.content,
    playbackComplete: isTerminal ? true : m.playbackComplete,
  };
}

function messagesEqualForRemoteTask(a: Message, b: Message): boolean {
  const aLog = a.activityLog;
  const bLog = b.activityLog;
  const logEqual =
    (aLog?.length ?? 0) === (bLog?.length ?? 0) &&
    (aLog?.[aLog.length - 1] ?? "") === (bLog?.[bLog.length - 1] ?? "");
  return (
    a.taskStatus === b.taskStatus &&
    a.taskProgress === b.taskProgress &&
    a.content === b.content &&
    a.taskError === b.taskError &&
    a.playbackComplete === b.playbackComplete &&
    (a.taskResult?.summary ?? "") === (b.taskResult?.summary ?? "") &&
    logEqual
  );
}

function RunAppSuggestion({
  messages,
  environmentStatus,
  onRunApp,
  dismissedFor,
  onDismiss,
}: {
  messages: Message[];
  environmentStatus?: string;
  onRunApp?: (() => void) | undefined;
  dismissedFor: string | null;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!onRunApp || !environmentStatus || environmentStatus === "PROVISIONING") return null;

  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "assistant") return null;
  if (lastMsg.taskStatus !== "DONE") return null;
  if (!lastMsg.taskResult || lastMsg.taskResult.changes.length === 0) return null;
  if (dismissedFor === lastMsg.id) return null;

  const isAlreadyRunning = environmentStatus === "RUNNING";
  const msgId = lastMsg.id;

  return (
    <AnimatePresence>
      <motion.div
        key={`run-suggestion-${msgId}`}
        className="flex w-full gap-3 justify-start"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <SynaroAssistantAvatar />
        <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm max-w-[80%] max-xl:max-w-[min(100%,20rem)]">
          <div className="flex items-center gap-2 text-foreground mb-3">
            <PlayIcon className="h-4 w-4 text-primary shrink-0" />
            <span>
              {isAlreadyRunning ? t("aiChat.restartAppPrompt") : t("aiChat.runAppPrompt")}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onRunApp();
                onDismiss(msgId);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
            >
              <PlayIcon className="h-3 w-3" />
              {isAlreadyRunning ? t("aiChat.restart") : t("aiChat.runTheApp")}
            </button>
            <button
              type="button"
              onClick={() => onDismiss(msgId)}
              className="inline-flex items-center rounded-xl border border-border/70 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t("agents.maybeLater")}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedAIChat({
  className,
  projectId,
  projectSlug,
  environmentStatus,
  onRunApp,
}: {
  className?: string;
  projectId?: string;
  projectSlug?: string;
  environmentStatus?: string;
  onRunApp?: () => void;
}) {
  const storageKey = projectId ? `synaro:chat:${projectId}` : null;
  const { t, locale } = useTranslation();
  const { activeTask, polledTask, setActiveTask } = useAiBackgroundTask();
  const chatPreview = useWorkspaceChatPreview();
  const handleOpenWorkspaceFile = React.useCallback(
    (path: string) => {
      chatPreview?.openFile(path);
    },
    [chatPreview],
  );

  const [value, setValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAsking, setIsAsking] = React.useState(false);
  const [runSuggestionDismissedFor, setRunSuggestionDismissedFor] = React.useState<string | null>(null);
  // Blocks the save effect from running until the localStorage restore has completed on mount,
  // preventing the initial empty messages array from overwriting previously saved history.
  const [chatHydrated, setChatHydrated] = React.useState(false);
  const [pendingClarification, setPendingClarification] = React.useState<PendingClarification | null>(null);
  const [activeSuggestion, setActiveSuggestion] = React.useState<number>(-1);
  const paletteRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
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
        setMessages(
          restored.map((m) => ({
            ...m,
            playbackComplete:
              isTerminalTaskStatus(m.taskStatus) || m.role === "user" || !m.taskId
                ? true
                : Boolean(m.playbackComplete),
          })),
        );
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
          setActiveTask({
            projectId,
            projectSlug: projectSlug ?? null,
            taskId: running.taskId,
            status: running.taskStatus,
            progress: running.taskProgress ?? null,
          });
          void (async () => {
            try {
              const res = await fetch(`/api/ai-tasks/${encodeURIComponent(running.taskId!)}`, {
                cache: "no-store",
              });
              if (!res.ok) return;
              const task = (await res.json()) as RemoteTask;
              setMessages((prev) => {
                let touched = false;
                const next = prev.map((m) => {
                  if (m.taskId !== task.id) return m;
                  const merged = mergeMessageWithRemoteTask(m, task, t);
                  if (messagesEqualForRemoteTask(m, merged)) return m;
                  touched = true;
                  return merged;
                });
                return touched ? next : prev;
              });
              if (isTerminalTaskStatus(task.status)) setIsSubmitting(false);
            } catch {
              /* ignore */
            }
          })();
        }
      }
    } catch {}
    setChatHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollRafRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const streaming = messages.some(
        (m) =>
          m.taskStatus &&
          m.taskStatus !== "DONE" &&
          m.taskStatus !== "FAILED" &&
          Boolean(m.content?.trim()),
      );
      messagesEndRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
    });
    return () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages]);

  // Persist chat history (debounced — avoid blocking the main thread during streaming)
  React.useEffect(() => {
    if (!storageKey || !chatHydrated) return;
    const id = window.setTimeout(() => {
      try {
        const toSave = messages.slice(-100).map((m, idx, arr) => {
          const isRecent = idx >= Math.max(0, arr.length - 6);
          if (isRecent) return m;
          return {
            ...m,
            activityLog: m.activityLog ? m.activityLog.slice(-12) : undefined,
          };
        });
        localStorage.setItem(storageKey, JSON.stringify(toSave));
      } catch {}
    }, 900);
    return () => window.clearTimeout(id);
  }, [messages, storageKey, chatHydrated]);

  const commandSuggestions: CommandSuggestion[] = React.useMemo(
    () => [
      {
        icon: <ImageIcon className="h-4 w-4" />,
        label: t("aiChat.cloneUi"),
        description: t("aiChat.cloneUiDesc"),
        prefix: "/clone",
      },
      {
        icon: <Figma className="h-4 w-4" />,
        label: t("aiChat.importFigma"),
        description: t("aiChat.importFigmaDesc"),
        prefix: "/figma",
      },
      {
        icon: <MonitorIcon className="h-4 w-4" />,
        label: t("aiChat.createPage"),
        description: t("aiChat.createPageDesc"),
        prefix: "/page",
      },
      {
        icon: <Sparkles className="h-4 w-4" />,
        label: t("aiChat.improve"),
        description: t("aiChat.improveDesc"),
        prefix: "/improve",
      },
    ],
    [t],
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

  const markPlaybackComplete = React.useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, playbackComplete: true } : m)),
    );
  }, []);

  React.useEffect(() => {
    if (!polledTask) return;
    const terminal = isTerminalTaskStatus(polledTask.status);
    setMessages((prev) => {
      let touched = false;
      const next = prev.map((m) => {
        if (m.taskId !== polledTask.id) return m;
        const merged = mergeMessageWithRemoteTask(m, polledTask as RemoteTask, t);
        if (!terminal && messagesEqualForRemoteTask(m, merged)) return m;
        touched = true;
        return merged;
      });
      return touched ? next : prev;
    });
    if (terminal) {
      setIsSubmitting(false);
    }
  }, [polledTask]);

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
        content: t("aiChat.workingOnRequest"),
        taskId: activeTask.taskId,
        taskStatus: activeTask.status,
        taskProgress: activeTask.progress ?? null,
        activityLog: activeTask.progress ? [activeTask.progress] : [],
        playbackComplete: true,
      },
    ]);
    setIsSubmitting(true);
  }, [activeTask, messages, projectId]);

  /** Start the actual code generation task with a (possibly combined) prompt. */
  const submitGeneration = React.useCallback(
    async (prompt: string, mode: "generate" | "answer" = "generate") => {
      if (!projectId) return;

      const asstMsgId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: asstMsgId,
          role: "assistant",
          content: t("aiChat.workingOnRequest"),
          taskStatus: "PENDING",
          taskProgress: t("aiChat.statusStarting"),
          activityLog: buildActivityLog([], "PENDING", t("aiChat.statusStarting"), undefined, t),
          playbackComplete: false,
        },
      ]);

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/ai-task`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, mode }),
          },
        );
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    content: t("aiChat.taskSubmissionFailed"),
                    taskStatus: "FAILED",
                    taskError: data.error ?? t("aiChat.errorStatus", { status: res.status }),
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
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? {
                  ...m,
                  content: t("aiChat.networkErrorAi"),
                  taskStatus: "FAILED",
                  taskProgress: null,
                }
              : m,
          ),
        );
        setIsSubmitting(false);
      }
    },
    [projectId, projectSlug, setActiveTask, t],
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
          content: t("aiChat.noProjectConnected"),
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
      await submitGeneration(combined, "generate");
      return;
    }

    // Git commit/push/create-repo — run immediately (clarify is for new feature builds only)
    if (isGitOnlyWorkflowPrompt(prompt)) {
      await submitGeneration(prompt, "generate");
      return;
    }

    // If the user is asking a question, answer it without modifying files.
    if (isLikelyQuestion(prompt)) {
      await submitGeneration(prompt, "answer");
      return;
    }

    // Otherwise, ask clarifying questions first
    const forceClarify = wantsStrictClarification(prompt);
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
        ? ((await clarifyRes.json()) as { required?: boolean; questions?: string[] })
        : { required: false, questions: [] };

      const questions = clarifyData.questions ?? [];
      const required = Boolean(clarifyData.required);

      if (!forceClarify && (!required || questions.length === 0)) {
        // No questions — generate directly
        setIsAsking(false);
        await submitGeneration(prompt, "generate");
        return;
      }

      if (questions.length === 0) {
        // User requested strict clarification but model didn't ask anything; proceed anyway.
        setIsAsking(false);
        await submitGeneration(prompt, "generate");
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
      await submitGeneration(prompt, "generate");
    }
  }, [value, isSubmitting, isAsking, projectId, pendingClarification, adjustHeight, submitGeneration]);

  const handleSendRef = React.useRef(handleSend);
  handleSendRef.current = handleSend;

  const isBusy = isSubmitting || isAsking;

  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  const { isListening, toggle: toggleVoice, stop: stopVoice } = useSpeechInput({
    disabled: isBusy,
    lang: localeToBcp47(locale),
    locale,
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
    ? t("aiChat.answerOrSkip")
    : t("aiChat.askQuestion");

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
                {t("aiChat.buildIdeaTitle")}
              </h2>
              <div className="mx-auto mt-2 h-px w-56 max-w-full bg-gradient-to-r from-transparent via-foreground/15 to-transparent max-xl:w-40" />
              <p className="mt-3 hidden text-sm text-muted-foreground xl:block">
                {t("aiChat.buildIdeaSubtitle")}
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
                onOpenFile={chatPreview ? handleOpenWorkspaceFile : undefined}
              />
            ))}
            {isAsking && (
              <motion.div
                className="flex w-full gap-3 justify-start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SynaroAssistantAvatar />
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-2.5">
                  <ThinkingMessage />
                </div>
              </motion.div>
            )}
            <RunAppSuggestion
              messages={messages}
              environmentStatus={environmentStatus}
              onRunApp={onRunApp}
              dismissedFor={runSuggestionDismissedFor}
              onDismiss={setRunSuggestionDismissedFor}
            />
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
                  {t("aiChat.listeningHint")}
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
                        aria-label={t("aiChat.removeAttachment")}
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
                {t("aiChat.skipQuestions")}
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
                placeholder={isListening ? t("aiChat.listening") : placeholder}
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
                <VoiceMicButton
                  isListening={isListening}
                  busy={isBusy}
                  sizeClassName="h-9 w-9 sm:h-10 sm:w-10"
                  onToggle={toggleVoice}
                  onUnsupported={(msg) => {
                    setVoiceError(msg);
                    window.setTimeout(() => setVoiceError(null), 5000);
                  }}
                />
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
                      aria-label={t("aiChat.moreActions")}
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
                      <span>{t("aiChat.attachFile")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      {t("aiChat.commands")}
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
                    isAsking ? t("aiChat.thinking") : isSubmitting ? t("aiChat.building") : t("aiChat.sendMessage")
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
                    {isAsking ? t("aiChat.thinkingEllipsis") : isSubmitting ? t("aiChat.buildingEllipsis") : t("aiChat.send")}
                  </span>
                </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
