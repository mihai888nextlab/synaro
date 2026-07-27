"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, StopCircle } from "lucide-react";

import { AgentRunSteps } from "@/components/ui/agents/agent-run-steps";
import { AgentStatusBadge } from "@/components/ui/agents/agent-status-badge";
import { RunArtifactsPanel } from "@/components/ui/agents/run-artifacts-panel";
import { useAgentBackgroundRuns } from "@/components/ui/agent-background-runs";
import { useTranslation } from "@/components/ui/locale-provider";
import type { AgentRun, McpCredentialRequest } from "@/lib/agents/agent-types";
import { normalizeRunArtifacts } from "@/lib/agents/run-artifacts";
import { normalizeSteps, resolveRunOutputText } from "@/lib/agents/run-preview";
import { cn } from "@/lib/utils";

const POLL_MS = 2_000;

function isActiveStatus(status: string) {
  return status === "PENDING" || status === "RUNNING" || status === "NEEDS_INPUT";
}

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
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
  const { refreshSoon } = useAgentBackgroundRuns();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [submittingCredentials, setSubmittingCredentials] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const credentialsSectionRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const req = run?.credentialRequest;
    if (!req?.fields?.length) {
      setCredentialValues({});
      return;
    }
    setCredentialValues((prev) => {
      const next: Record<string, string> = {};
      for (const field of req.fields) {
        next[field.key] = prev[field.key] ?? "";
      }
      return next;
    });
  }, [run?.credentialRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#run-credentials") return;
    if (run?.status !== "NEEDS_INPUT" || !run.credentialRequest) return;

    const section = credentialsSectionRef.current;
    if (!section) return;

    section.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstInput = section.querySelector<HTMLInputElement>("input");
    firstInput?.focus({ preventScroll: true });
  }, [run?.status, run?.credentialRequest]);

  const submitCredentials = async (req: McpCredentialRequest) => {
    setSubmittingCredentials(true);
    setCredentialError("");
    try {
      const headers: Record<string, string> = {};
      for (const field of req.fields) {
        const value = credentialValues[field.key]?.trim();
        if (!value) {
          setCredentialError(t("agents.credentialsRequired"));
          return;
        }
        headers[field.key] = value.startsWith("Bearer ") ? value : `Bearer ${value}`;
      }

      const res = await fetch(`/api/agents/runs/${encodeURIComponent(runId)}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcpAuth: { [req.server]: headers } }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCredentialError(data.error ?? t("agents.credentialsSubmitFailed"));
        return;
      }
      setCredentialValues({});
      await fetchRun();
    } catch {
      setCredentialError(t("agents.credentialsSubmitFailed"));
    } finally {
      setSubmittingCredentials(false);
    }
  };

  const cancelRun = async () => {
    if (!window.confirm(t("agents.cancelRunConfirm"))) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/agents/runs/${encodeURIComponent(runId)}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setCancelError(data.error ?? t("agents.cancelRunFailed"));
        return;
      }
      refreshSoon();
      await fetchRun();
    } catch {
      setCancelError(t("agents.cancelRunFailed"));
    } finally {
      setCancelling(false);
    }
  };

  const displayName = initialAgentName?.trim() || t("agents.runDetailTitle");
  const steps = normalizeSteps(run?.steps);
  const displayOutput = run ? resolveRunOutputText(run) : null;
  const artifacts = normalizeRunArtifacts(run?.artifacts);
  const finishedViaSteps = Boolean(
    run &&
      isActiveStatus(run.status) &&
      steps.some((step) => step.tool === "finish" && step.observation.trim()),
  );
  const isLive = Boolean(run && isActiveStatus(run.status) && !finishedViaSteps);
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
                <div className="flex flex-wrap items-center gap-2">
                  {isLive ? (
                    <button
                      type="button"
                      onClick={() => void cancelRun()}
                      disabled={cancelling}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancelling ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <StopCircle className="size-3" aria-hidden />
                      )}
                      {t("agents.cancelRun")}
                    </button>
                  ) : null}
                  <AgentStatusBadge status={run.status} />
                </div>
              </div>
              {cancelError ? (
                <p className="mt-3 text-xs text-red-400">{cancelError}</p>
              ) : null}
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

            {run.status === "NEEDS_INPUT" && run.credentialRequest ? (
              <section
                id="run-credentials"
                ref={credentialsSectionRef}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6"
              >
                <h2 className="text-sm font-medium text-foreground">{t("agents.credentialsTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("agents.credentialsPrompt", { server: run.credentialRequest.server })}
                </p>
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitCredentials(run.credentialRequest!);
                  }}
                >
                  {run.credentialRequest.fields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <input
                        type={field.type === "password" ? "password" : "text"}
                        autoComplete="off"
                        value={credentialValues[field.key] ?? ""}
                        onChange={(e) =>
                          setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                  {credentialError ? <p className="text-xs text-red-400">{credentialError}</p> : null}
                  <button
                    type="submit"
                    disabled={submittingCredentials}
                    className="inline-flex w-fit items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submittingCredentials ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {t("agents.credentialsSubmit")}
                  </button>
                </form>
              </section>
            ) : null}

            {artifacts.length > 0 ? (
              <section className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
                <RunArtifactsPanel artifacts={artifacts} title={t("agents.runArtifacts")} />
              </section>
            ) : null}

            {displayOutput && (run.status === "FAILED" || run.status === "CANCELLED") ? (
              <section
                className={cn(
                  "rounded-xl border p-5 sm:p-6",
                  run.status === "FAILED"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/70 bg-muted/30",
                )}
              >
                <h2 className="text-sm font-medium text-foreground">
                  {run.status === "FAILED" ? t("agents.runError") : t("agents.statusCancelled")}
                </h2>
                {run.status === "FAILED" ? (
                  <p className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-red-400 [overflow-wrap:anywhere]">
                    {displayOutput}
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{displayOutput}</p>
                )}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
