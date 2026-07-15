"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { AgentRunSteps } from "@/components/ui/agents/agent-run-steps";
import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import { MarkdownLite } from "@/components/ui/markdown-lite";
import { useTranslation } from "@/components/ui/locale-provider";
import type { AgentRun } from "@/lib/agents/agent-types";
import type { ReActStep } from "@/lib/agents/react-step";
import { cn } from "@/lib/utils";

const POLL_MS = 2_000;

function isActiveStatus(status: string) {
  return status === "PENDING" || status === "RUNNING";
}

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function normalizeSteps(steps: AgentRun["steps"]): ReActStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter(
    (step): step is ReActStep =>
      typeof step === "object" &&
      step !== null &&
      typeof (step as ReActStep).step === "number" &&
      typeof (step as ReActStep).tool === "string",
  );
}

type AgentRunDetailPageClientProps = {
  agentId: string;
  runId: string;
  agentName?: string;
};

export function AgentRunDetailPageClient({
  agentId,
  runId,
  agentName: initialAgentName,
}: AgentRunDetailPageClientProps) {
  const { t } = useTranslation();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/runs/${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(res.status === 404 ? t("agents.runNotFound") : t("agents.runLoadFailed"));
        return;
      }
      const data = (await res.json()) as AgentRun;
      setRun(data);
      setError("");
    } catch {
      setError(t("agents.runLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [runId, t]);

  useEffect(() => {
    void fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!run || !isActiveStatus(run.status)) return;

    pollRef.current = setInterval(() => void fetchRun(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [run?.status, fetchRun]);

  const displayName = initialAgentName?.trim() || t("agents.runDetailTitle");
  const steps = normalizeSteps(run?.steps);
  const isLive = Boolean(run && isActiveStatus(run.status));
  const startedAt = formatTimestamp(run?.startedAt ?? run?.createdAt);
  const finishedAt = formatTimestamp(run?.finishedAt);

  return (
    <div className="relative w-full flex-1">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/agents"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("agents.backToAgents")}
        </Link>

        {loading && !run ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && !run ? (
          <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : run ? (
          <div className="flex flex-col gap-6">
            <header className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {displayName}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {run.trigger}
                  </p>
                </div>
                <AgentStatusBadge status={run.status} />
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {startedAt ? (
                  <div>
                    <dt className="inline">{t("agents.startedAt")}: </dt>
                    <dd className="inline text-foreground/80">{startedAt}</dd>
                  </div>
                ) : null}
                {finishedAt ? (
                  <div>
                    <dt className="inline">{t("agents.finishedAt")}: </dt>
                    <dd className="inline text-foreground/80">{finishedAt}</dd>
                  </div>
                ) : null}
              </dl>
            </header>

            {run.input?.trim() ? (
              <section className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
                <h2 className="text-sm font-medium text-foreground">{t("agents.runInput")}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {run.input}
                </p>
              </section>
            ) : null}

            <section className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">{t("agents.runSteps")}</h2>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/50 opacity-60" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                    </span>
                    {t("agents.runStepsLive")}
                  </span>
                ) : null}
              </div>
              <AgentRunSteps steps={steps} isLive={isLive} />
            </section>

            {run.output?.trim() ? (
              <section className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
                <h2 className="text-sm font-medium text-foreground">{t("agents.runOutput")}</h2>
                <div
                  className={cn(
                    "mt-3 max-h-[32rem] overflow-auto rounded-lg border border-border/50 bg-muted/30 p-4",
                  )}
                >
                  <MarkdownLite text={run.output} />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
