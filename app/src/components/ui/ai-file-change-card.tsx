"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileCode2 } from "lucide-react";

import {
  buildFileChangePreview,
  type FileChangePreviewLine,
  splitLines,
} from "@/lib/file-change-preview";
import { useTypewriter } from "@/lib/use-typewriter";
import { cn } from "@/lib/utils";

function PreviewLine({
  line,
  animate,
  delayMs = 0,
}: {
  line: FileChangePreviewLine;
  animate: boolean;
  delayMs?: number;
}) {
  const shouldType = animate && line.kind === "add";
  const { displayed, isComplete } = useTypewriter(line.text, {
    enabled: shouldType,
    charsPerTick: 3,
    intervalMs: 12,
  });
  const text = shouldType ? displayed : line.text;

  return (
    <motion.div
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: delayMs / 1000 }}
      className={cn(
        "px-3 py-0.5 font-mono text-[0.6875rem] leading-5 sm:text-xs sm:leading-5",
        line.kind === "add" && "bg-emerald-500/15 text-emerald-100/95",
        line.kind === "remove" && "bg-red-500/10 text-red-300/80 line-through decoration-red-400/40",
        line.kind === "context" && "text-muted-foreground/55",
      )}
    >
      {text}
      {shouldType && !isComplete ? (
        <span className="ml-0.5 inline-block animate-pulse text-emerald-400/80">▍</span>
      ) : null}
    </motion.div>
  );
}

export function AiFileChangeCard({
  path,
  content,
  previousContent,
  animate = true,
  index = 0,
  onOpenFile,
}: {
  path: string;
  content: string;
  previousContent?: string | null;
  animate?: boolean;
  index?: number;
  onOpenFile?: (path: string) => void;
}) {
  const preview = React.useMemo(
    () => buildFileChangePreview(path, content, previousContent),
    [path, content, previousContent],
  );

  const fullLines = React.useMemo(() => {
    const lines = splitLines(content);
    const isNewFile = previousContent == null;
    return lines.map(
      (text): FileChangePreviewLine => ({
        kind: isNewFile ? "add" : "context",
        text,
      }),
    );
  }, [content, previousContent]);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.06 }}
      className="overflow-hidden rounded-lg border border-border/60 bg-zinc-950/90 shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky-400/90" />
        {onOpenFile ? (
          <button
            type="button"
            onClick={() => onOpenFile(path)}
            className="min-w-0 truncate text-left font-mono text-xs text-primary underline-offset-2 hover:underline"
            title={`Open ${path}`}
          >
            {path}
          </button>
        ) : (
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{preview.fileName}</span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[0.6875rem]">
          {preview.added > 0 ? (
            <span className="text-emerald-400">+{preview.added}</span>
          ) : null}
          {preview.removed > 0 ? (
            <span className="text-red-400/90">-{preview.removed}</span>
          ) : null}
        </div>
      </div>
      <div className="max-h-40 overflow-auto sm:max-h-48">
        {fullLines.map((line, lineIdx) => (
          <PreviewLine
            key={`${line.kind}-${lineIdx}-${line.text.slice(0, 24)}`}
            line={line}
            animate={animate}
            delayMs={index * 60 + lineIdx * 40}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function AiFileChangeCardList({
  changes,
  animate = true,
  onOpenFile,
}: {
  changes: { path: string; content: string; previousContent?: string | null }[];
  animate?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  if (changes.length === 0) return null;

  return (
    <div className="space-y-2">
      {changes.map((change, i) => (
        <AiFileChangeCard
          key={change.path}
          path={change.path}
          content={change.content}
          previousContent={change.previousContent}
          animate={animate}
          index={i}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
