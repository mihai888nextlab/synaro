"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import { AgentRunSteps } from "@/components/ui/agents/agent-run-steps";
import { useTranslation } from "@/components/ui/locale-provider";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import type { AgentRun } from "@/lib/agents/agent-types";
import {
  getRunCardPreview,
  normalizeSteps,
  resolveRunOutputText,
  truncatePreview,
  type RunPreviewVariant,
} from "@/lib/agents/run-preview";
import { cn } from "@/lib/utils";

type AgentRunCardProps = {
  run: AgentRun;
  agentId: string;
  variant?: RunPreviewVariant;
};

function isLiveStatus(status: AgentRun["status"]): boolean {
  return status === "PENDING" || status === "RUNNING" || status === "NEEDS_INPUT";
}

/** Final output only — keep it bounded so MarkdownLite stays cheap. */
const EMBEDDED_OUTPUT_MAX = 2_000;

export function AgentRunCard({ run, agentId, variant = "compact" }: AgentRunCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = new Date(run.createdAt).toLocaleString();
  const steps = normalizeSteps(run.steps);
  const preview = getRunCardPreview(
    run,
    {
      running: t("agents.runPreviewRunning"),
      needsInput: (server) => t("agents.runPreviewNeedsInput", { server }),
      cancelled: t("agents.statusCancelled"),
      noOutput: t("agents.runPreviewNoOutput"),
    },
    { variant },
  );

  const runDetailHref = `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(run.id)}`;
  const credentialsHref = `${runDetailHref}#run-credentials`;

  const openRunDetail = () => {
    void router.push(runDetailHref);
  };

  const isEmbedded = variant === "embedded";
  const isExpanded = variant === "expanded" || isEmbedded;
  const live = isLiveStatus(run.status);

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <AgentStatusBadge status={run.status} />
          <span className="text-xs text-muted-foreground capitalize">{run.trigger}</span>
          {steps.length > 0 && (
            <span className="text-xs text-muted-foreground/70">
              {t("agents.stepsCount", { count: steps.length })}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground/70">{date}</span>
      </div>
      {isEmbedded ? (
        <Link
          href={runDetailHref}
          className="shrink-0 text-xs text-muted-foreground transition hover:text-foreground"
        >
          {t("agents.viewRun")}
        </Link>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">{t("agents.viewRun")}</span>
      )}
    </div>
  );

  // Dashboard / expanded: live steps while running, markdown only for the final answer.
  let bodyPreview: ReactNode = null;
  if (isExpanded && live) {
    // Webhook lag: finish already wrote the answer but status is still RUNNING.
    const earlyOutput = resolveRunOutputText(run);
    const hasFinish = steps.some((s) => s.tool === "finish" && s.observation.trim());
    if (earlyOutput && hasFinish) {
      bodyPreview = (
        <MarkdownLite
          text={truncatePreview(earlyOutput, EMBEDDED_OUTPUT_MAX)}
          className={cn(
            "text-sm leading-relaxed",
            !isEmbedded && "text-muted-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:text-xs",
          )}
        />
      );
    } else {
      bodyPreview = <AgentRunSteps steps={steps} isLive />;
    }
  } else if (isExpanded && run.status === "DONE") {
    const output = resolveRunOutputText(run);
    if (output) {
      bodyPreview = (
        <MarkdownLite
          text={truncatePreview(output, EMBEDDED_OUTPUT_MAX)}
          className={cn(
            "text-sm leading-relaxed",
            !isEmbedded && "text-muted-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:text-xs",
          )}
        />
      );
    } else {
      bodyPreview = (
        <p className="text-sm italic text-muted-foreground/50">{t("agents.runPreviewNoOutput")}</p>
      );
    }
  } else if (isExpanded && (preview.kind === "error" || preview.kind === "cancelled")) {
    bodyPreview = (
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          preview.kind === "error" ? "text-red-400" : "text-muted-foreground",
        )}
      >
        {preview.text}
      </p>
    );
  } else if (!isExpanded) {
    const showPreview = preview.kind !== "empty" || preview.text.length > 0;
    if (showPreview) {
      bodyPreview = (
        <p
          className={cn(
            "line-clamp-2 text-sm leading-relaxed",
            preview.kind === "error" && "text-red-400",
            preview.kind === "needs-input" && "text-amber-400/90",
            (preview.kind === "output" ||
              preview.kind === "activity" ||
              preview.kind === "cancelled" ||
              preview.kind === "empty") &&
              (preview.kind === "empty"
                ? "text-muted-foreground/50 italic"
                : "text-muted-foreground"),
          )}
        >
          {preview.text}
        </p>
      );
    }
  }

  const body = (
    <>
      {header}

      {bodyPreview ? (
        <div
          className={cn(
            "mt-3 min-w-0 overflow-hidden break-words [overflow-wrap:anywhere]",
            isExpanded && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          {bodyPreview}
        </div>
      ) : null}

      {preview.kind === "needs-input" ? (
        <div className={cn("mt-3 shrink-0", !isEmbedded && "border-t border-amber-500/20 pt-3")}>
          <Link
            href={credentialsHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition hover:text-amber-300"
          >
            {t("agents.provideCredentials")}
          </Link>
        </div>
      ) : null}
    </>
  );

  if (isEmbedded) {
    return <div className="flex h-full min-h-0 flex-col">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={openRunDetail}
      className={cn(
        "w-full rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-border hover:bg-muted/20",
        isExpanded && "flex h-full min-h-0 flex-col",
      )}
    >
      {body}
    </button>
  );
}
