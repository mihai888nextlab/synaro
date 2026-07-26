"use client";

import { useState } from "react";
import { KeyRound, Loader2, LogOut, Shield, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import type { GetServerSideProps } from "next";

import { ApiKeysSettingsPanel } from "@/components/ui/settings/api-keys-settings-panel";
import {
  SettingsLayout,
  SettingsSection,
} from "@/components/ui/settings/settings-layout";
import { useTranslation } from "@/components/ui/locale-provider";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

type SecurityPageProps = {
  hasPassword: boolean;
  email: string;
};

export default function SecuritySettingsPage({ hasPassword, email }: SecurityPageProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [signOutEverywhereBusy, setSignOutEverywhereBusy] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError(t("settings.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPasswordError(data.error ?? t("settings.passwordSaveFailed"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        hasPassword ? t("settings.passwordUpdated") : t("settings.passwordSet"),
      );
    } catch {
      setPasswordError(t("settings.passwordSaveFailed"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!window.confirm(t("settings.signOutEverywhereConfirm"))) return;
    setSignOutEverywhereBusy(true);
    setSessionMessage("");
    try {
      const res = await fetch("/api/account/sessions?everywhere=1", { method: "POST" });
      if (!res.ok) throw new Error(t("settings.signOutEverywhereFailed"));
      await signOut({ callbackUrl: "/login" });
    } catch {
      setSessionMessage(t("settings.signOutEverywhereFailed"));
      setSignOutEverywhereBusy(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm(t("settings.deleteAccountConfirm"))) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          password: hasPassword ? deletePassword : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? t("settings.deleteAccountFailed"));
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError(t("settings.deleteAccountFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsLayout
      title={t("settings.securityTitle")}
      description={t("settings.securityDescription")}
    >
      <div className="flex flex-col gap-6">
        <SettingsSection
          icon={KeyRound}
          title={t("nav.apiKeys")}
          description={t("settings.apiKeysSectionDescription")}
        >
          <ApiKeysSettingsPanel />
        </SettingsSection>

        <SettingsSection
          icon={Shield}
          title={hasPassword ? t("settings.changePasswordTitle") : t("settings.setPasswordTitle")}
          description={
            hasPassword
              ? t("settings.changePasswordDescription")
              : t("settings.setPasswordDescription")
          }
        >
          <form onSubmit={(e) => void handlePasswordSubmit(e)} className="flex max-w-md flex-col gap-3">
            {hasPassword ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="current-password" className="text-xs font-medium text-muted-foreground">
                  {t("settings.currentPassword")}
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
                {t("settings.newPassword")}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
                {t("settings.confirmPassword")}
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {passwordError ? <p className="text-xs text-red-400">{passwordError}</p> : null}
            {passwordMessage ? <p className="text-xs text-emerald-500">{passwordMessage}</p> : null}
            <button
              type="submit"
              disabled={passwordSaving || !newPassword || !confirmPassword}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {passwordSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {hasPassword ? t("settings.updatePassword") : t("settings.setPassword")}
            </button>
          </form>
        </SettingsSection>

        <SettingsSection
          icon={LogOut}
          title={t("settings.sessionsTitle")}
          description={t("settings.sessionsDescription")}
        >
          <button
            type="button"
            onClick={() => void handleSignOutEverywhere()}
            disabled={signOutEverywhereBusy}
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {signOutEverywhereBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("settings.signOutEverywhere")}
          </button>
          {sessionMessage ? <p className="mt-3 text-sm text-red-400">{sessionMessage}</p> : null}
        </SettingsSection>

        <SettingsSection
          icon={Trash2}
          title={t("settings.deleteAccountTitle")}
          description={t("settings.deleteAccountDescription")}
        >
          <form onSubmit={(e) => void handleDeleteAccount(e)} className="flex max-w-md flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {t("settings.deleteAccountTypeEmail", { email })}
            </p>
            <input
              type="email"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={email}
              autoComplete="off"
              className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {hasPassword ? (
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t("settings.deleteAccountPasswordPlaceholder")}
                autoComplete="current-password"
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            ) : null}
            {deleteError ? <p className="text-xs text-red-400">{deleteError}</p> : null}
            <button
              type="submit"
              disabled={
                deleting ||
                deleteConfirmation.trim().toLowerCase() !== email.toLowerCase() ||
                (hasPassword && !deletePassword)
              }
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t("settings.deleteAccount")}
            </button>
          </form>
        </SettingsSection>
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps<SecurityPageProps> = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, passwordHash: true },
  });

  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  return {
    props: {
      hasPassword: Boolean(user.passwordHash),
      email: user.email,
    },
  };
};
