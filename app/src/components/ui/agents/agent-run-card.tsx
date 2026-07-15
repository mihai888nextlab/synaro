"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import { useTranslation } from "@/components/ui/locale-provider";
import type { AgentRun } from "@/lib/agents/agent-types";
import { getRunCardPreview, normalizeSteps } from "@/lib/agents/run-preview";
import { cn } from "@/lib/utils";

type AgentRunCardProps = {
  run: AgentRun;
  agentId: string;
};

export function AgentRunCard({ run, agentId }: AgentRunCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const date = new Date(run.createdAt).toLocaleString();
  const steps = normalizeSteps(run.steps);
  const preview = getRunCardPreview(run, {
    running: t("agents.runPreviewRunning"),
    needsInput: (server) => t("agents.runPreviewNeedsInput", { server }),
    cancelled: t("agents.statusCancelled"),
    noOutput: t("agents.runPreviewNoOutput"),
  });

  const runDetailHref = `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(run.id)}`;
  const credentialsHref = `${runDetailHref}#run-credentials`;

  const openRunDetail = () => {
    void router.push(runDetailHref);
  };

  const previewClassName = cn(
    "line-clamp-2 text-sm leading-relaxed",
    preview.kind === "error" && "text-red-400",
    preview.kind === "needs-input" && "text-amber-400/90",
    (preview.kind === "output" ||
      preview.kind === "activity" ||
      preview.kind === "cancelled" ||
      preview.kind === "empty") &&
      (preview.kind === "empty" ? "text-muted-foreground/50 italic" : "text-muted-foreground"),
  );

  const showPreview = preview.kind !== "empty" || preview.text.length > 0;

  return (
    <button
      type="button"
      onClick={openRunDetail}
      className="w-full rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-border hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
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
        <span className="shrink-0 text-xs text-muted-foreground">{t("agents.viewRun")}</span>
      </div>

      {showPreview ? (
        <p className={cn("mt-3", previewClassName)}>{preview.text}</p>
      ) : null}

      {preview.kind === "needs-input" ? (
        <div className="mt-3 border-t border-amber-500/20 pt-3">
          <Link
            href={credentialsHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 transition hover:text-amber-300"
          >
            {t("agents.provideCredentials")}
          </Link>
        </div>
      ) : null}
    </button>
  );
}
