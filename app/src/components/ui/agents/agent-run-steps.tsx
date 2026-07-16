"use client";

import { Loader2 } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import type { ReActStep } from "@/lib/agents/react-step";
import { isBulkyToolObservation } from "@/lib/agents/run-preview";
import { cn } from "@/lib/utils";

const OBSERVATION_PREVIEW_LEN = 120;

function observationPreview(tool: string, observation: string): string {
  const trimmed = observation.trim();
  if (!trimmed) return "";
  if (isBulkyToolObservation(trimmed)) {
    const kb = Math.max(1, Math.round(trimmed.length / 1024));
    if (tool === "http_get" || tool === "http_post") return `Fetched page (~${kb} KB)`;
    return `Large result (~${kb} KB)`;
  }
  // Collapse whitespace so HTML/JSON dumps don't blow the layout.
  const flat = trimmed.replace(/\s+/g, " ");
  if (flat.length <= OBSERVATION_PREVIEW_LEN) return flat;
  return `${flat.slice(0, OBSERVATION_PREVIEW_LEN - 1).trimEnd()}…`;
}

export function AgentRunSteps({
  steps,
  isLive,
}: {
  steps: ReActStep[];
  isLive?: boolean;
}) {
  const { t } = useTranslation();

  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
        {isLive ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>{t("agents.runStepsLive")}</span>
          </>
        ) : (
          <span>{t("agents.runStepsEmpty")}</span>
        )}
      </div>
    );
  }

  const latestIndex = steps.length - 1;

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isLatest = Boolean(isLive && index === latestIndex);
        const isDone = !isLatest;
        const hasNext = index < steps.length - 1;
        const preview = observationPreview(step.tool, step.observation);

        return (
          <li key={`${step.step}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
            {hasNext ? (
              <span
                className={cn(
                  "absolute left-[11px] top-5 h-[calc(100%-0.5rem)] w-px",
                  isDone ? "bg-emerald-500/35" : "bg-border/70",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold tabular-nums",
                isLatest
                  ? "border-emerald-400 bg-emerald-400/20 text-emerald-300 motion-safe:animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                  : isDone
                    ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
                    : "border-border/70 bg-muted/30 text-muted-foreground",
              )}
            >
              {step.step}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("agents.stepTool")}
                </span>
                <code className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {step.tool}
                </code>
              </div>
              {preview ? (
                <p
                  className={cn(
                    "mt-2 max-w-full overflow-hidden break-words text-sm leading-relaxed [overflow-wrap:anywhere]",
                    isLatest ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {preview}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
