"use client";

import Link from "next/link";
import { BookOpen, Globe, Link2, Plug, Settings2, Share2 } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

/** Public API & programmatic access — machine green. */
function ApiSnippet() {
  const { t } = useTranslation();

  return (
    <div
      id="api"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-emerald-500/10 px-4 py-2.5">
        <span className="text-xs font-medium text-emerald-300/90">{t("features.api.title")}</span>
        <Globe className="size-3.5 text-emerald-500/40" aria-hidden />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
        <code>
          <span className="text-emerald-700/80"># {t("features.mock.apiComment")}</span>
          {"\n"}
          <span className="text-emerald-300">curl</span>
          <span className="text-zinc-500"> -X POST </span>
          <span className="text-emerald-200/90">https://synaro.tech/api/v1/projects</span>
          {"\n"}
          <span className="text-zinc-500">  -H </span>
          <span className="text-emerald-300/80">&quot;Authorization: Bearer sk_…&quot;</span>
          {"\n"}
          <span className="text-zinc-500">  -d </span>
          <span className="text-emerald-300/80">&apos;{`{"name":"my-app"}`}&apos;</span>
        </code>
      </pre>
      <p className="border-t border-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-zinc-400">
        {t("features.api.body")}
      </p>
    </div>
  );
}

/** Sharing & invites — collaboration purple. */
function ShareLinksMock() {
  const { t } = useTranslation();

  return (
    <div
      id="collaboration"
      className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-zinc-950 p-6"
    >
      <Share2 className="size-5 text-violet-300/80" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.collaboration.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.collaboration.body")}</p>

      <div className="relative mt-6 min-h-[100px]">
        <div className="absolute left-0 top-0 w-[85%] rotate-[-2deg] rounded-xl border border-violet-500/20 bg-violet-950/40 p-3 shadow-lg">
          <p className="text-[10px] uppercase tracking-wide text-violet-400/50">
            {t("features.mock.shareProjectLabel")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-violet-300">
            <Link2 className="size-3 shrink-0" aria-hidden />
            {t("features.mock.shareProject")}
          </p>
        </div>
        <div className="absolute bottom-0 right-0 w-[78%] rotate-[2deg] rounded-xl border border-violet-500/30 bg-violet-950/60 p-3 shadow-lg">
          <p className="text-[10px] uppercase tracking-wide text-violet-400/50">
            {t("features.mock.shareAgentLabel")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-violet-200">
            <Link2 className="size-3 shrink-0" aria-hidden />
            {t("features.mock.shareAgent")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Language & theme — personalization purple. */
function PreferencesPills() {
  const { t } = useTranslation();

  return (
    <div
      id="preferences"
      className="scroll-mt-24 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-5"
    >
      <Settings2 className="size-5 text-violet-400/70" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.preferences.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.preferences.body")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-violet-500/20 bg-violet-950/30 px-3 py-1 text-xs text-violet-200/70">
          EN
        </span>
        <span className="rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1 text-xs text-violet-200">
          RO
        </span>
        <span className="rounded-full border border-violet-500/15 px-3 py-1 text-xs text-violet-300/40">
          ☀ light
        </span>
        <span className="rounded-full border border-violet-500/35 bg-violet-500/15 px-3 py-1 text-xs text-violet-200">
          ☾ dark
        </span>
      </div>
    </div>
  );
}

/** Documentation — knowledge purple. */
function DocsStack() {
  const { t } = useTranslation();

  const pages = [
    t("features.mock.docPage1"),
    t("features.mock.docPage2"),
    t("features.mock.docPage3"),
  ];

  return (
    <div
      id="documentation"
      className="scroll-mt-24 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-5"
    >
      <BookOpen className="size-5 text-violet-400/80" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.documentation.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.documentation.body")}</p>
      <div className="relative mt-5 h-24">
        {pages.map((page, i) => (
          <div
            key={page}
            className={cn(
              "absolute left-0 right-0 rounded-lg border border-violet-500/15 bg-violet-950/50 px-3 py-2 text-xs text-violet-200/60",
              i === 0 && "top-0 z-30 shadow-md",
              i === 1 && "top-3 z-20 opacity-80",
              i === 2 && "top-6 z-10 opacity-60",
            )}
            style={{ transform: `rotate(${i * 1.5 - 1.5}deg)` }}
          >
            {page}
          </div>
        ))}
      </div>
      <Link
        href="/documentation"
        className="mt-8 inline-block text-xs font-medium text-violet-300/90 transition hover:text-violet-200"
      >
        {t("features.mock.browseDocs")} →
      </Link>
    </div>
  );
}

/** MCP integrations — machine connectivity green. */
function McpNodes() {
  const { t } = useTranslation();

  return (
    <div
      id="mcp"
      className="scroll-mt-24 col-span-full rounded-2xl border border-dashed border-emerald-500/25 bg-emerald-950/10 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <Plug className="size-5 text-emerald-400/70" aria-hidden />
          <h3 className="mt-3 text-lg font-medium text-white">{t("features.mcp.title")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.mcp.body")}</p>
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-4" aria-hidden>
          <span className="rounded-lg border border-emerald-500/15 bg-emerald-950/30 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-emerald-500/50">
            MCP client
          </span>
          <span className="h-px w-8 bg-emerald-500/40 sm:w-12" />
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-[10px] font-medium text-emerald-300">
            Synaro
          </span>
          <span className="h-px w-8 bg-emerald-500/40 sm:w-12" />
          <span className="rounded-lg border border-emerald-500/15 bg-emerald-950/30 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-emerald-500/50">
            deploy · logs
          </span>
        </div>
      </div>
    </div>
  );
}

export function FeaturesConnectSection() {
  const { t } = useTranslation();

  return (
    <section id="connect" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-400/80">
          {t("features.sections.connect")}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
          {t("features.sections.connectTagline")}
        </h2>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <ApiSnippet />
        <ShareLinksMock />
        <PreferencesPills />
        <DocsStack />
        <McpNodes />
      </div>
    </section>
  );
}
