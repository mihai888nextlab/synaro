"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FeaturesAutomateSection } from "@/components/ui/features/features-automate-section";
import { FeaturesBuildSection } from "@/components/ui/features/features-build-section";
import { FeaturesConnectSection } from "@/components/ui/features/features-connect-section";
import { MinimalFooter } from "@/components/ui/minimal-footer";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import { useTranslation } from "@/components/ui/locale-provider";

const HERO_PILLS = [
  "features.hero.pill1",
  "features.hero.pill2",
  "features.hero.pill3",
  "features.hero.pill4",
] as const;

export function FeaturesPageClient() {
  const { t } = useTranslation();

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
        <SiteHeader />

        <section className="relative mx-auto max-w-7xl px-4 pb-6 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(100%,36rem)] -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-500/10 to-transparent blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
              {t("features.hero.badge")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-tight">
              {t("features.hero.title")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {t("features.hero.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {HERO_PILLS.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400"
                >
                  {t(key)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <FeaturesBuildSection />
        <FeaturesAutomateSection />
        <FeaturesConnectSection />

        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 p-6 text-center sm:p-10">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06),transparent_70%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold sm:text-3xl">{t("features.cta.title")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
                {t("features.cta.subtitle")}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  {t("features.cta.getStarted")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t("features.cta.signIn")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <MinimalFooter />
      </div>
    </main>
  );
}
