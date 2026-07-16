"use client";

import Link from "next/link";
import { BookOpen, Globe, Link2, Plug, Settings2, Share2 } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

function ApiSnippet() {
  const { t } = useTranslation();

  return (
    <div
      id="api"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-medium text-white/90">{t("features.api.title")}</span>
        <Globe className="size-3.5 text-white/40" aria-hidden />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
        <code>
          <span className="text-white/35"># {t("features.mock.apiComment")}</span>
          {"\n"}
          <span className="text-white">curl</span>
          <span className="text-zinc-500"> -X POST </span>
          <span className="text-white/90">https://synaro.tech/api/v1/projects</span>
          {"\n"}
          <span className="text-zinc-500">  -H </span>
          <span className="text-white/75">&quot;Authorization: Bearer sk_…&quot;</span>
          {"\n"}
          <span className="text-zinc-500">  -d </span>
          <span className="text-white/75">&apos;{`{"name":"my-app"}`}&apos;</span>
        </code>
      </pre>
      <p className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-zinc-400">
        {t("features.api.body")}
      </p>
    </div>
  );
}

function ShareLinksMock() {
  const { t } = useTranslation();

  return (
    <div
      id="collaboration"
      className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.06] to-zinc-950 p-6"
    >
      <Share2 className="size-5 text-white/80" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.collaboration.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.collaboration.body")}</p>

      <div className="relative mt-6 min-h-[100px]">
        <div className="absolute left-0 top-0 w-[85%] rotate-[-2deg] rounded-xl border border-white/15 bg-white/[0.05] p-3 shadow-lg">
          <p className="text-[10px] uppercase tracking-wide text-white/45">
            {t("features.mock.shareProjectLabel")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-white/85">
            <Link2 className="size-3 shrink-0" aria-hidden />
            {t("features.mock.shareProject")}
          </p>
        </div>
        <div className="absolute bottom-0 right-0 w-[78%] rotate-[2deg] rounded-xl border border-white/25 bg-white/[0.08] p-3 shadow-lg">
          <p className="text-[10px] uppercase tracking-wide text-white/45">
            {t("features.mock.shareAgentLabel")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-white">
            <Link2 className="size-3 shrink-0" aria-hidden />
            {t("features.mock.shareAgent")}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreferencesPills() {
  const { t } = useTranslation();

  return (
    <div
      id="preferences"
      className="scroll-mt-24 rounded-2xl border border-white/15 bg-white/[0.03] p-5"
    >
      <Settings2 className="size-5 text-white/60" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.preferences.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.preferences.body")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
          EN
        </span>
        <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white">
          RO
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/35">
          ☀ light
        </span>
        <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs text-white">
          ☾ dark
        </span>
      </div>
    </div>
  );
}

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
      className="scroll-mt-24 rounded-2xl border border-white/15 bg-white/[0.03] p-5"
    >
      <BookOpen className="size-5 text-white/70" aria-hidden />
      <h3 className="mt-3 text-lg font-medium text-white">{t("features.documentation.title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.documentation.body")}</p>
      <div className="relative mt-5 h-24">
        {pages.map((page, i) => (
          <div
            key={page}
            className={cn(
              "absolute left-0 right-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white/55",
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
        className="mt-8 inline-block text-xs font-medium text-white/85 transition hover:text-white"
      >
        {t("features.mock.browseDocs")} →
      </Link>
    </div>
  );
}

function McpNodes() {
  const { t } = useTranslation();

  return (
    <div
      id="mcp"
      className="scroll-mt-24 col-span-full rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <Plug className="size-5 text-white/60" aria-hidden />
          <h3 className="mt-3 text-lg font-medium text-white">{t("features.mcp.title")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("features.mcp.body")}</p>
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-4" aria-hidden>
          <span className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-white/45">
            MCP client
          </span>
          <span className="h-px w-8 bg-white/40 sm:w-12" />
          <span className="rounded-lg border border-white/25 bg-white/[0.08] px-3 py-2 text-[10px] font-medium text-white">
            Synaro
          </span>
          <span className="h-px w-8 bg-white/40 sm:w-12" />
          <span className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-white/45">
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
        <p className="text-xs uppercase tracking-[0.25em] text-white/70">
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
