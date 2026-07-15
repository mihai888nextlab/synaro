"use client";

import { Bot, LayoutDashboard, Search } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

/** Agents, runs, cron — autonomous green. */
function AgentRunMock() {
  const { t } = useTranslation();

  const steps = [
    { label: t("features.mock.agentStepQueued"), done: true },
    { label: t("features.mock.agentStepSearch"), done: true },
    { label: t("features.mock.agentStepRunning"), active: true },
    { label: t("features.mock.agentStepDone"), done: false },
  ];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-emerald-500/20 bg-zinc-950/90 p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-950/50">
          <Bot className="size-5 text-emerald-400" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{t("features.mock.agentRun")}</p>
          <p className="text-xs text-emerald-400/90">{t("features.mock.agentStatus")}</p>
        </div>
      </div>
      <ol className="mt-6 flex-1 space-y-0">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "absolute left-[7px] top-4 h-full w-px",
                  step.done ? "bg-emerald-500/40" : "bg-white/10",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-0.5 size-3.5 shrink-0 rounded-full border-2",
                step.active
                  ? "border-emerald-400 bg-emerald-400/30 motion-safe:animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                  : step.done
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-white/20 bg-transparent",
              )}
            />
            <span
              className={cn(
                "text-sm",
                step.active ? "font-medium text-emerald-200" : step.done ? "text-zinc-400" : "text-zinc-600",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Dashboard layout & widgets — product UI purple. */
function DashboardBentoMock() {
  const { t } = useTranslation();

  const widgets = [
    { w: "col-span-2", h: "h-14", opacity: "bg-violet-500/18" },
    { w: "col-span-1", h: "h-14", opacity: "bg-violet-500/12" },
    { w: "col-span-1", h: "h-20", opacity: "bg-violet-500/10" },
    { w: "col-span-2", h: "h-20", opacity: "bg-violet-500/14" },
  ];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-violet-300/80">
        <LayoutDashboard className="size-3.5" aria-hidden />
        {t("features.dashboard.title")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {widgets.map((w, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-violet-500/15 border-dashed",
              w.w,
              w.h,
              w.opacity,
            )}
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] text-violet-400/40">{t("features.mock.dashboardHint")}</p>
    </div>
  );
}

/** Command palette — navigation UI purple. */
function SearchPaletteMock() {
  const { t } = useTranslation();

  return (
    <div className="relative rounded-2xl border border-violet-500/20 bg-violet-950/25 p-4 shadow-[0_16px_48px_rgba(139,92,246,0.08)]">
      <div className="flex items-center gap-2 rounded-lg border border-violet-500/15 bg-black/50 px-3 py-2.5">
        <Search className="size-4 shrink-0 text-violet-400/70" aria-hidden />
        <span className="text-sm text-violet-200/50">{t("features.mock.searchPlaceholder")}</span>
        <kbd className="ml-auto hidden rounded border border-violet-500/25 bg-violet-950/50 px-1.5 py-0.5 font-mono text-[10px] text-violet-300/80 sm:inline">
          ⌘K
        </kbd>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {[t("features.mock.searchResult1"), t("features.mock.searchResult2")].map((row) => (
          <li
            key={row}
            className="rounded-md px-2 py-1.5 text-violet-200/60 transition hover:bg-violet-500/10"
          >
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeaturesAutomateSection() {
  const { t } = useTranslation();

  return (
    <section
      id="automate"
      className="relative scroll-mt-24 border-y border-white/5 bg-zinc-950/40 py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(16,185,129,0.06),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-400/80">
            {t("features.sections.automate")}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
            {t("features.sections.automateTagline")}
          </h2>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
          <div className="lg:col-span-7 lg:row-span-2">
            <AgentRunMock />
            <p id="agents" className="mt-4 scroll-mt-24 text-sm leading-relaxed text-zinc-400 sm:max-w-md">
              <span className="font-medium text-white">{t("features.agents.title")}. </span>
              {t("features.agents.body")}
            </p>
          </div>

          <div id="dashboard" className="scroll-mt-24 lg:col-span-5">
            <DashboardBentoMock />
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              {t("features.dashboard.body")}
            </p>
          </div>

          <div id="search" className="scroll-mt-24 lg:col-span-5">
            <SearchPaletteMock />
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              <span className="font-medium text-white">{t("features.search.title")}. </span>
              {t("features.search.body")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
