"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import { useTranslation } from "@/components/ui/locale-provider";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import type { AgentRun } from "@/lib/agents/agent-types";
import {
  getRunCardPreview,
  normalizeSteps,
  type RunPreviewVariant,
} from "@/lib/agents/run-preview";
import { cn } from "@/lib/utils";

type AgentRunCardProps = {
  run: AgentRun;
  agentId: string;
  variant?: RunPreviewVariant;
};

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
  const showPreview = preview.kind !== "empty" || preview.text.length > 0;

  const previewContent = (() => {
    if (!showPreview) return null;

    if (isExpanded && preview.kind === "output") {
      return (
        <MarkdownLite
          text={preview.text}
          className={cn(
            "text-sm leading-relaxed",
            !isEmbedded && "text-muted-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:text-xs",
          )}
        />
      );
    }

    if (isExpanded && preview.kind === "activity") {
      return (
        <MarkdownLite
          text={preview.text}
          className={cn(
            "text-sm leading-relaxed",
            !isEmbedded && "text-muted-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_pre]:text-xs",
          )}
        />
      );
    }

    const previewClassName = cn(
      "text-sm leading-relaxed",
      !isExpanded && "line-clamp-2",
      preview.kind === "error" && "text-red-400",
      preview.kind === "needs-input" && "text-amber-400/90",
      (preview.kind === "output" ||
        preview.kind === "activity" ||
        preview.kind === "cancelled" ||
        preview.kind === "empty") &&
        (preview.kind === "empty" ? "text-muted-foreground/50 italic" : "text-muted-foreground"),
      isExpanded && preview.kind === "error" && "whitespace-pre-wrap",
      isExpanded && preview.kind === "cancelled" && "whitespace-pre-wrap",
    );

    return <p className={previewClassName}>{preview.text}</p>;
  })();

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

  const body = (
    <>
      {header}

      {previewContent ? (
        <div
          className={cn(
            "mt-3 min-w-0 overflow-hidden break-words [overflow-wrap:anywhere]",
            isExpanded && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          {previewContent}
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
