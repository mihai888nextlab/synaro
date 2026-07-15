import type { GetServerSideProps } from "next";
import { KeyRound, Shield, Sparkles, UserRound, Wrench } from "lucide-react";

import {
  SettingsLayout,
  SettingsOverviewCard,
} from "@/components/ui/settings/settings-layout";
import { useTranslation } from "@/components/ui/locale-provider";
import { requireAuth } from "@/lib/auth-redirect";

export default function SettingsPage() {
  const { t } = useTranslation();

  const cards = [
    {
      href: "/settings/profile",
      title: t("nav.profile"),
      description: t("settings.profileCardDescription"),
      icon: UserRound,
    },
    {
      href: "/settings/preferences",
      title: t("nav.preferences"),
      description: t("settings.preferencesCardDescription"),
      icon: Sparkles,
    },
    {
      href: "/settings/workspace",
      title: t("settings.workspace"),
      description: t("settings.workspaceCardDescription"),
      icon: Wrench,
    },
    {
      href: "/settings/security",
      title: t("settings.security"),
      description: t("settings.securityCardDescription"),
      icon: Shield,
    },
    {
      href: "/settings/api-keys",
      title: t("nav.apiKeys"),
      description: t("settings.apiKeysCardDescription"),
      icon: KeyRound,
    },
  ] as const;

  return (
    <SettingsLayout title={t("settings.title")} description={t("settings.hubDescription")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <SettingsOverviewCard key={card.href} {...card} />
        ))}
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
