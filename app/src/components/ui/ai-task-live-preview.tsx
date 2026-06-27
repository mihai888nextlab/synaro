"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { useTypewriter } from "@/lib/use-typewriter";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/ui/markdown-lite";

function BlinkCursor() {
  return (
    <motion.span
      className="ml-0.5 inline-block text-primary/80"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      ▍
    </motion.span>
  );
}

export function TaskLivePreview({
  activityLog,
  activeLine,
  className,
  animate = true,
}: {
  activityLog: string[];
  activeLine: string;
  className?: string;
  animate?: boolean;
}) {
  const completedLines = React.useMemo(() => {
    if (activityLog.length === 0) return [];
    const last = activityLog[activityLog.length - 1];
    if (last === activeLine) return activityLog.slice(0, -1);
    return activityLog;
  }, [activityLog, activeLine]);

  const { displayed, isComplete } = useTypewriter(activeLine, {
    enabled: animate && activeLine.length > 0,
    charsPerTick: 2,
    intervalMs: 16,
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-zinc-950/80 px-3 py-2.5 shadow-inner",
        className,
      )}
    >
      <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/80">
        Live activity
      </p>
      <div className="max-h-32 space-y-1 overflow-y-auto font-mono text-[0.6875rem] leading-relaxed sm:max-h-40 sm:text-xs">
        {completedLines.map((line, i) => (
          <motion.p
            key={`${i}-${line.slice(0, 24)}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 0.55, x: 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <span className="select-none text-primary/40">› </span>
            {line}
          </motion.p>
        ))}
        {activeLine ? (
          <p className="whitespace-pre-wrap text-foreground/95">
            <span className="select-none text-primary/60">› </span>
            {displayed}
            {!isComplete ? <BlinkCursor /> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TypewriterMarkdown({
  text,
  enabled,
  className,
  onComplete,
  streaming = false,
}: {
  text: string;
  enabled: boolean;
  className?: string;
  onComplete?: () => void;
  /** Slower reveal while tokens are still arriving from the server. */
  streaming?: boolean;
}) {
  const { displayed, isComplete } = useTypewriter(text, {
    enabled,
    charsPerTick: streaming ? 1 : 3,
    intervalMs: streaming ? 32 : 14,
    catchUpThreshold: streaming ? 120 : 40,
    catchUpCharsPerTick: streaming ? 4 : 32,
  });

  React.useEffect(() => {
    if (!enabled) return;
    if (isComplete) onComplete?.();
  }, [enabled, isComplete, onComplete]);

  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {displayed}
      {enabled && !isComplete ? <BlinkCursor /> : null}
    </p>
  );
}

export function TypewriterMarkdownLite({
  text,
  enabled,
  className,
  onComplete,
  streaming = false,
  onOpenFile,
}: {
  text: string;
  enabled: boolean;
  className?: string;
  onComplete?: () => void;
  /** Faster catch-up while tokens are still arriving from the server. */
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { displayed, isComplete } = useTypewriter(text, {
    enabled,
    charsPerTick: streaming ? 6 : 3,
    intervalMs: streaming ? 10 : 14,
    catchUpThreshold: streaming ? 24 : 40,
    catchUpCharsPerTick: streaming ? 48 : 32,
  });

  React.useEffect(() => {
    if (!enabled) return;
    if (isComplete) onComplete?.();
  }, [enabled, isComplete, onComplete]);

  return (
    <div className={cn("text-left", className)}>
      <MarkdownLite text={displayed} onOpenFile={onOpenFile} />
      {enabled && !isComplete ? (
        <span className="whitespace-pre-wrap">
          <BlinkCursor />
        </span>
      ) : null}
    </div>
  );
}
