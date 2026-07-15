"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import {
  Bot,
  KeyRound,
  LayoutDashboard,
  Shield,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

type SettingsNavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
};

const NAV_ITEMS: SettingsNavItem[] = [
  { href: "/settings/profile", labelKey: "nav.profile", icon: UserRound },
  { href: "/settings/preferences", labelKey: "nav.preferences", icon: Sparkles },
  { href: "/settings/workspace", labelKey: "settings.workspace", icon: Wrench },
  { href: "/settings/security", labelKey: "settings.security", icon: Shield },
  { href: "/settings/api-keys", labelKey: "nav.apiKeys", icon: KeyRound },
];

export function SettingsLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const path = router.pathname;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label={t("settings.navAriaLabel")}
          className="flex shrink-0 flex-row gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/30 p-1 lg:w-52 lg:flex-col"
        >
          {NAV_ITEMS.map((item) => {
            const active = path === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
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

/** Icons re-exported for overview page */
export { Bot, LayoutDashboard };
