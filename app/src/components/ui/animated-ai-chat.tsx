"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Command,
  LoaderIcon,
  Paperclip,
  SendIcon,
  Sparkles,
  MonitorIcon,
  ImageIcon,
  Figma,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type CommandSuggestion = {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
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
    <div className="flex items-center">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="mx-0.5 h-1.5 w-1.5 rounded-full bg-foreground/80"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function AnimatedAIChat({ className }: { className?: string }) {
  const [value, setValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [activeSuggestion, setActiveSuggestion] = React.useState<number>(-1);
  const paletteRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(56, 180);

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
      if (!value.trim()) return;
      setIsTyping(true);
      window.setTimeout(() => {
        setIsTyping(false);
        setValue("");
        adjustHeight(true);
      }, 1600);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files);
    setAttachments((prev) => [...prev, ...next]);
    // allow re-selecting the same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const pickSuggestion = (idx: number) => {
    const cmd = commandSuggestions[idx];
    setValue(`${cmd.prefix} `);
    setActiveSuggestion(-1);
  };

  return (
    <div className={cn("lab-bg relative h-full w-full overflow-hidden", className)}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-4 py-6 sm:px-6">
        <motion.div
          className="relative z-10 space-y-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="text-center">
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Let&apos;s run your idea!
            </h2>
            <div className="mx-auto mt-2 h-px w-56 bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Type a command or ask a question</p>
          </div>

          <motion.div
            className="relative overflow-visible rounded-2xl border border-border/70 bg-card/70 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.22)]"
            initial={{ scale: 0.99 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <AnimatePresence>
              {showCommandPalette && (
                <motion.div
                  ref={paletteRef}
                  className="absolute left-4 right-4 bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl"
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
                placeholder="Ask Synaro a question…"
                className={cn(
                  "min-h-[56px] w-full resize-none bg-transparent px-1 py-1 text-sm text-foreground",
                  "placeholder:text-muted-foreground/60 focus:outline-none",
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
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-xl bg-foreground/[0.035] opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  />
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
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-xl bg-foreground/[0.035] opacity-0"
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  />
                </motion.button>
              </div>

              <motion.button
                type="button"
                onClick={() => {
                  if (!value.trim()) return;
                  setIsTyping(true);
                  window.setTimeout(() => {
                    setIsTyping(false);
                    setValue("");
                    adjustHeight(true);
                  }, 1600);
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isTyping || !value.trim()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                  value.trim()
                    ? "bg-foreground text-background shadow-sm shadow-black/5"
                    : "border border-border/70 bg-muted text-muted-foreground",
                )}
              >
                {isTyping ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                Send
              </motion.button>
            </div>
          </motion.div>

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

        <AnimatePresence>
          {isTyping && (
            <motion.div
              className="pointer-events-none fixed bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-xs text-muted-foreground shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-muted text-[10px] font-medium text-foreground">
                  syn
                </div>
                <div className="flex items-center gap-2">
                  <span>Thinking</span>
                  <TypingDots />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

