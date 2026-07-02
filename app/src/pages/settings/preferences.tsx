import { useEffect, useState } from "react";
import { Languages, Monitor, MoonStar, Sun } from "lucide-react";
import type { GetServerSideProps } from "next";

import { useLocale } from "@/components/ui/locale-provider";
import { useTheme, type ThemeMode } from "@/components/ui/theme-provider";
import { LOCALE_LABELS, type Locale } from "@/i18n/config";
import { requireAuth } from "@/lib/auth-redirect";

const themeOptions: Array<{
  mode: ThemeMode;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { mode: "system", titleKey: "settings.themeSystem", descriptionKey: "settings.themeSystemDesc", icon: Monitor },
  { mode: "dark", titleKey: "settings.themeDark", descriptionKey: "settings.themeDarkDesc", icon: MoonStar },
  { mode: "light", titleKey: "settings.themeLight", descriptionKey: "settings.themeLightDesc", icon: Sun },
];

const languageOptions: Array<{ locale: Locale; titleKey: string }> = [
  { locale: "en", titleKey: "settings.languageEnglish" },
  { locale: "ro", titleKey: "settings.languageRomanian" },
];

export default function PreferencesPage() {
  const { mode, resolvedMode, setMode } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const modeTitleKey =
    mode === "system"
      ? "settings.themeSystem"
      : mode === "dark"
        ? "settings.themeDark"
        : "settings.themeLight";

  const currentModeLabel =
    mode === "system"
      ? t("settings.appearanceSystem", { resolved: resolvedMode })
      : t(modeTitleKey);

  const appearanceHint = hydrated
    ? t("settings.appearanceHint", { mode: currentModeLabel })
    : t("settings.appearanceHint", {
        mode: t("settings.appearanceSystem", { resolved: "light" }),
      });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div className="flex items-center gap-2">
          <Languages className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">{t("settings.language")}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.languageHint")}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {languageOptions.map((opt) => {
            const active = locale === opt.locale;
            return (
              <button
                key={opt.locale}
                type="button"
                onClick={() => void setLocale(opt.locale)}
                className={[
                  "group rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-border bg-muted"
                    : "border-border/70 bg-background/40 hover:bg-muted",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{t(opt.titleKey)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground/80">{LOCALE_LABELS[opt.locale]}</p>
                  </div>
                  <div
                    className={[
                      "size-4 rounded-full border transition",
                      active ? "border-foreground bg-foreground" : "border-border/80",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div>
          <p className="text-sm font-medium text-foreground">{t("settings.appearance")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{appearanceHint}</p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {themeOptions.map((opt) => {
            const active = mode === opt.mode;
            const Icon = opt.icon;

            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setMode(opt.mode)}
                className={[
                  "group rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-border bg-muted"
                    : "border-border/70 bg-background/40 hover:bg-muted",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card">
                      <Icon className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{t(opt.titleKey)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground/80">{t(opt.descriptionKey)}</p>
                    </div>
                  </div>

                  <div
                    className={[
                      "size-4 rounded-full border transition",
                      active ? "border-foreground bg-foreground" : "border-border/80",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
