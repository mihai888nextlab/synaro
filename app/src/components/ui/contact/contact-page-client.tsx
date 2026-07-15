"use client";

import Link from "next/link";

import { MinimalFooter } from "@/components/ui/minimal-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { useTranslation } from "@/components/ui/locale-provider";
import { SYNARO_CONTACT_EMAIL, SYNARO_MAILTO_HREF } from "@/lib/site-contact";

export function ContactPageClient() {
  const { t } = useTranslation();

  return (
    <main id="main-content" className="min-h-screen bg-black text-white">
      <SiteHeader />

      <section className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{t("contact.hero.badge")}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("contact.hero.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t("contact.hero.subtitle")}</p>

        <div className="mt-10 space-y-6 border-t border-white/10 pt-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{t("contact.email.title")}</p>
            <a
              href={SYNARO_MAILTO_HREF}
              className="mt-2 inline-block text-base text-white underline decoration-white/20 underline-offset-4 transition hover:decoration-white/50"
            >
              {SYNARO_CONTACT_EMAIL}
            </a>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{t("contact.location.title")}</p>
            <p className="mt-2 text-sm text-zinc-400">{t("contact.location.body")}</p>
          </div>
        </div>

        <Link
          href="/about"
          className="mt-10 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          {t("contact.aboutLink")} →
        </Link>
      </section>

      <MinimalFooter />
    </main>
  );
}
