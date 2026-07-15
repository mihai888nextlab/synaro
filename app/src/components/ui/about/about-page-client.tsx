"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Code2, MapPin } from "lucide-react";

import { EuropeMapHero } from "@/components/ui/about/europe-map-hero";
import { FounderCard } from "@/components/ui/about/founder-card";
import { MinimalFooter } from "@/components/ui/minimal-footer";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import { useTranslation } from "@/components/ui/locale-provider";

const VEST_VENTURES_URL =
  "https://vestventures.vc/en/events/pre-accelerator-vest-ventures-timisoara";

export function AboutPageClient() {
  const { t } = useTranslation();

  const pillars = [
    {
      icon: MapPin,
      title: t("about.europe.pillar1Title"),
      body: t("about.europe.pillar1Body"),
    },
    {
      icon: Box,
      title: t("about.europe.pillar2Title"),
      body: t("about.europe.pillar2Body"),
    },
    {
      icon: Code2,
      title: t("about.europe.pillar3Title"),
      body: t("about.europe.pillar3Body"),
    },
  ];

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
        <SiteHeader />

        <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
              {t("about.hero.badge")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {t("about.hero.title")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {t("about.hero.subtitle")}
            </p>
          </div>

          <EuropeMapHero className="mt-10 sm:mt-12" />
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
          <h2 className="text-center text-sm uppercase tracking-[0.2em] text-zinc-500">
            {t("about.mission.title")}
          </h2>
          <p className="mt-5 text-center text-base leading-relaxed text-zinc-300 sm:text-lg">
            {t("about.mission.body")}
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <h2 className="text-center text-sm uppercase tracking-[0.2em] text-zinc-500">
            {t("about.europe.title")}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6"
              >
                <pillar.icon className="size-5 text-amber-300/90" aria-hidden />
                <h3 className="mt-4 text-lg font-medium text-white">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-center sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {t("about.vest.label")}
            </p>
            <a
              href={VEST_VENTURES_URL}
              target="_blank"
              rel="noreferrer"
              className="mx-auto mt-5 inline-flex transition-opacity hover:opacity-90"
            >
              <Image
                src="/about/vest-ventures-logo.svg"
                alt="Vest Ventures"
                width={170}
                height={40}
                className="h-8 w-auto sm:h-9"
              />
            </a>
            <h2 className="mt-5 text-xl font-semibold text-white sm:text-2xl">
              {t("about.vest.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              {t("about.vest.body")}
            </p>
            <a
              href={VEST_VENTURES_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm text-amber-200/90 transition hover:text-amber-100"
            >
              {t("about.vest.link")}
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
          <h2 className="text-center text-sm uppercase tracking-[0.2em] text-zinc-500">
            {t("about.team.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-zinc-400 sm:text-base">
            {t("about.team.schoolLine")}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <FounderCard
              name={t("about.team.cristianName")}
              role={t("about.team.cristianRole")}
              bio={t("about.team.cristianBio")}
              github="https://github.com/crististg"
              photoSrc="/about/cristi.jpg"
              initials="CS"
            />
            <FounderCard
              name={t("about.team.mihaiName")}
              role={t("about.team.mihaiRole")}
              bio={t("about.team.mihaiBio")}
              github="https://github.com/mihai888nextlab"
              photoSrc="/about/mihai.jpg"
              initials="MG"
            />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="rounded-2xl border border-white/15 bg-zinc-950 p-6 text-center sm:p-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t("about.cta.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
              {t("about.cta.subtitle")}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t("about.cta.getStarted")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/documentation"
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("about.cta.readDocs")}
              </Link>
            </div>
          </div>
        </section>

        <MinimalFooter />
      </div>
    </main>
  );
}
