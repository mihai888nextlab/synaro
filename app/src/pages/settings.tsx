import Link from "next/link";
import type { GetServerSideProps } from "next";

import { useTranslation } from "@/components/ui/locale-provider";
import { requireAuth } from "@/lib/auth-redirect";

export default function SettingsPage() {
  const { t } = useTranslation();

  const placeholders = [
    { key: "settings.workspace", name: "workspace" },
    { key: "settings.security", name: "security" },
    { key: "settings.integrations", name: "integrations" },
  ] as const;

  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">{t("settings.title")}</p>
        <p className="mt-2 text-muted-foreground">{t("settings.placeholder")}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/profile"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("nav.profile")}
          </Link>
          <Link
            href="/settings/preferences"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("nav.preferences")}
          </Link>
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("nav.apiKeys")}
          </Link>
          <Link
            href="/settings/billing"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("settings.billing")}
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {placeholders.map((entry) => (
            <div key={entry.name} className="rounded-xl border border-border/70 bg-muted p-4">
              <p className="font-medium">{t(entry.key)}</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {entry.name === "security" ? (
                  <Link href="/settings/api-keys" className="underline-offset-4 hover:underline">
                    {t("settings.manageApiKeys")}
                  </Link>
                ) : (
                  t("common.comingSoon")
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
