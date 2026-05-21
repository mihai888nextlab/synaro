"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  Command,
  Figma,
  HelpCircleIcon,
  ImageIcon,
  LoaderIcon,
  MonitorIcon,
  Paperclip,
  SendIcon,
  Sparkles,
  UserIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type TaskStatus = "PENDING" | "ANALYZING" | "GENERATING" | "APPLYING" | "DONE" | "FAILED";

type TaskResult = {
  summary: string;
  changes: { path: string; content: string }[];
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isClarification = Boolean(message.questions && message.questions.length > 0);
  const isRunning =
    message.taskStatus &&
    message.taskStatus !== "DONE" &&
    message.taskStatus !== "FAILED";

  return (
    <motion.div
      className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted text-[10px] font-medium text-foreground">
          syn
        </div>
      )}

      <div className={cn("max-w-[80%] space-y-2", isUser ? "items-end" : "items-start")}>
        {/* Main bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-foreground text-background"
              : isClarification
                ? "border border-primary/30 bg-primary/5 text-foreground"
                : "border border-border/70 bg-card text-foreground",
          )}
        >
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
          ) : (
            message.content
          )}
        </div>

        {/* In-progress state */}
        {isRunning && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-3">
            <ProgressBar />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderIcon className="h-3 w-3 shrink-0 animate-spin" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={message.taskProgress ?? message.taskStatus}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {message.taskProgress ?? statusLabel(message.taskStatus!)}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Done state */}
        {message.taskStatus === "DONE" && message.taskResult && (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
              {message.taskResult.summary}
            </div>
            {message.taskResult.changes.length > 0 && (
              <div className="space-y-0.5 pt-0.5">
                {message.taskResult.changes.map((c) => (
                  <p key={c.path} className="font-mono text-[0.65rem] text-muted-foreground">
                    {c.path}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {message.taskStatus === "FAILED" && (
          <div className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message.taskError ?? "Task failed"}</span>
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

export function AnimatedAIChat({
  className,
  projectId,
}: {
  className?: string;
  projectId?: string;
}) {
  const storageKey = projectId ? `synaro:chat:${projectId}` : null;

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
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(56, 180);

  // Restore persisted messages after hydration
  React.useEffect(() => {
    if (!projectId) return;
    try {
      const saved = localStorage.getItem(`synaro:chat:${projectId}`);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
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
      const toSave = messages
        .filter((m) => !m.taskStatus || m.taskStatus === "DONE" || m.taskStatus === "FAILED")
        .slice(-100);
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
              prev.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      taskStatus: task.status,
                      taskProgress: task.progress ?? null,
                      taskResult: task.result ?? null,
                      taskError: task.errorMessage ?? null,
                    }
                  : m,
              ),
            );
            if (task.status === "DONE" || task.status === "FAILED") {
              stopPolling();
              setIsSubmitting(false);
            }
          } catch {
            /* ignore transient errors */
          }
        })();
      }, 1500);
    },
    [stopPolling],
  );

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

  const handleSend = React.useCallback(async () => {
    const prompt = value.trim();
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
  const isBusy = isSubmitting || isAsking;
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

      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
        {/* Empty state */}
        {!hasMessages && (
          <motion.div
            className="relative z-10 mb-8 space-y-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                Let&apos;s build your idea!
              </h2>
              <div className="mx-auto mt-2 h-px w-56 bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
              <p className="mt-3 text-sm text-muted-foreground">
                Describe what you want to build — I&apos;ll ask a few questions, then generate it.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {commandSuggestions.map((s, idx) => (
                <motion.button
                  key={s.prefix}
                  onClick={() => pickSuggestion(idx)}
                  className="relative inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/40 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
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

        {/* Message list */}
        {hasMessages && (
          <div className="mb-4 flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {/* Typing indicator while fetching clarification questions */}
            {isAsking && (
              <motion.div
                className="flex w-full gap-3 justify-start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted text-[10px] font-medium text-foreground">
                  syn
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm text-muted-foreground">
                  <TypingDots />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input box */}
        <motion.div
          className="relative overflow-visible rounded-2xl border border-border/70 bg-card/70 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
          initial={{ scale: 0.99 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <AnimatePresence>
            {showCommandPalette && (
              <motion.div
                ref={paletteRef}
                className="absolute bottom-full left-4 right-4 z-50 mb-2 overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl"
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

          <div className="p-4">
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
              placeholder={placeholder}
              disabled={isBusy}
              className={cn(
                "min-h-[56px] w-full resize-none bg-transparent px-1 py-1 text-sm text-foreground",
                "placeholder:text-muted-foreground/60 focus:outline-none",
                isBusy && "opacity-50 cursor-not-allowed",
              )}
              style={{ overflow: "hidden" }}
            />
          </div>

          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                className="px-4 pb-3"
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

          <div className="flex items-center justify-between gap-4 border-t border-border/70 p-4">
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                onClick={openFilePicker}
                whileTap={{ scale: 0.94 }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  if (showCommandPalette) setActiveSuggestion(-1);
                  else setActiveSuggestion(matchingSuggestionIndex);
                }}
                whileTap={{ scale: 0.94 }}
                className={cn(
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  showCommandPalette && "bg-muted text-foreground",
                )}
                aria-label="Toggle command palette"
              >
                <Command className="h-4 w-4" />
              </motion.button>

              {/* Skip clarification shortcut */}
              {pendingClarification && !isSubmitting && (
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Skip questions
                </motion.button>
              )}
            </div>

            <motion.button
              type="button"
              onClick={() => void handleSend()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={isBusy || !value.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
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
              {isAsking ? "Thinking…" : isSubmitting ? "Building…" : "Send"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
