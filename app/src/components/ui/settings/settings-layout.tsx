"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";

export function SettingsLayout({
  title,
  description,
  children,
  /** When false, hide the back control (settings hub). Defaults to true on subpages. */
  showBack,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const isHub = router.pathname === "/settings";
  const backVisible = showBack ?? !isHub;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {backVisible ? (
        <Link
          href="/settings"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          {t("settings.backToSettings")}
        </Link>
      ) : null}

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SettingsOverviewCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border/70 bg-card/80 p-5 transition hover:border-border hover:bg-muted/20"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
          <Icon className="size-4 text-muted-foreground transition group-hover:text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-6">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
          <div className={description || Icon ? "mt-5" : undefined}>{children}</div>
        </div>
      </div>
    </section>
  );
}
