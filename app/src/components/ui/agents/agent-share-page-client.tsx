"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ArrowRight, Bot, Loader2 } from "lucide-react";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export type AgentSharePageClientProps = {
  agentId: string;
  agentName: string;
  agentDescription: string | null;
  agentTools: string[];
  agentEnabled: boolean;
};

export function AgentSharePageClient({
  agentId,
  agentName,
  agentDescription,
  agentTools,
  agentEnabled,
}: AgentSharePageClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useSession();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const callbackPath = `/a/${encodeURIComponent(agentId)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;

  const importAgent = useCallback(async () => {
    setImporting(true);
    setError(null);
    try {
      const storageKey = `synaro.agentImport.${agentId}`;
      try {
        const existingId = sessionStorage.getItem(storageKey);
        if (existingId) {
          await router.replace(`/agents?highlight=${encodeURIComponent(existingId)}`);
          return;
        }
      } catch {
        // sessionStorage may be unavailable
      }

      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/import`, {
        method: "POST",
        credentials: "include",
      });
      const raw = await res.text();
      let data: { id?: string; error?: string; alreadyOwned?: boolean } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setError(t("agentShare.importFailed"));
          setImporting(false);
          return;
        }
      }
      if (!res.ok || !data.id) {
        setError(data.error ?? t("agentShare.importFailed"));
        setImporting(false);
        return;
      }
      try {
        sessionStorage.setItem(storageKey, data.id);
      } catch {
        // ignore
      }
      await router.replace(`/agents?highlight=${encodeURIComponent(data.id)}`);
    } catch {
      setError(t("agentShare.importFailed"));
      setImporting(false);
    }
  }, [agentId, router, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      void router.replace(loginHref);
      return;
    }
    if (status !== "authenticated" || startedRef.current) return;
    startedRef.current = true;
    void importAgent();
  }, [importAgent, loginHref, router, status]);

  const busy = status === "loading" || status === "unauthenticated" || importing;

  return (
    <main className="relative min-h-dvh bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
        <SiteHeader />
        <section className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
            {t("agentShare.badge")}
          </p>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-zinc-950">
            <Bot className="size-6 text-amber-300/90" aria-hidden />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{agentName}</h1>
          <span
            className={cn(
              "mt-4 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium",
              agentEnabled
                ? "border-emerald-500/35 bg-emerald-950/55 text-emerald-400"
                : "border-white/15 bg-zinc-950 text-zinc-400",
            )}
          >
            {agentEnabled ? t("agentShare.enabled") : t("agentShare.disabled")}
          </span>
          <p className="mt-4 max-w-lg text-lg text-zinc-400">
            {agentDescription?.trim() || t("agentShare.noDescription")}
          </p>
          {agentTools.length > 0 ? (
            <div className="mt-6 w-full max-w-md rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {t("agentShare.toolsLabel")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {agentTools.map((tool) => (
                  <li
                    key={tool}
                    className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-xs text-zinc-300"
                  >
                    {tool.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500">{t("agentShare.noTools")}</p>
          )}

          {busy && !error ? (
            <p className="mt-10 inline-flex items-center gap-2 text-sm text-zinc-300">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {status === "unauthenticated"
                ? t("agentShare.redirectingToSignIn")
                : t("agentShare.addingToAgents")}
            </p>
          ) : null}

          {error ? (
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={() => void importAgent()}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t("agentShare.addToMyAgents")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

        </section>
      </div>
    </main>
  );
}
