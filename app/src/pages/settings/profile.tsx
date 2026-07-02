import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import type { FormEvent } from "react";
import { useRouter } from "next/router";
import { Pencil } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";
import { oauthErrorMessage } from "@/lib/auth-oauth-errors";
import { useTranslation } from "@/components/ui/locale-provider";

type ProfilePageProps = {
  linkedGoogle: boolean;
  linkedGithub: boolean;
  hasPassword: boolean;
};

export default function ProfilePage({
  linkedGoogle: linkedGoogleInitial,
  linkedGithub: linkedGithubInitial,
  hasPassword,
}: ProfilePageProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, update } = useSession();
  const email = data?.user?.email ?? "—";
  const savedName = data?.user?.name ?? "";
  const [name, setName] = useState(savedName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [linkedGoogle, setLinkedGoogle] = useState(linkedGoogleInitial);
  const [linkedGithub, setLinkedGithub] = useState(linkedGithubInitial);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubDisconnectBusy, setGithubDisconnectBusy] = useState(false);
  const [githubMessage, setGithubMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(savedName);
  }, [savedName]);

  useEffect(() => {
    setLinkedGoogle(linkedGoogleInitial);
    setLinkedGithub(linkedGithubInitial);
  }, [linkedGoogleInitial, linkedGithubInitial]);

  useEffect(() => {
    const raw = router.query.error;
    const code = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
    if (code) {
      setGithubMessage(oauthErrorMessage(code, t));
      void router.replace("/settings/profile", undefined, { shallow: true });
    }
  }, [router]);

  const normalizedName = useMemo(() => name.trim().replace(/\s+/g, " "), [name]);
  const normalizedSavedName = useMemo(
    () => savedName.trim().replace(/\s+/g, " "),
    [savedName],
  );
  const canSave =
    normalizedName.length > 0 &&
    normalizedName !== normalizedSavedName &&
    !isSaving;

  const canDisconnectGithub = linkedGithub && (hasPassword || linkedGoogle);

  function handleEditStart() {
    setName(savedName);
    setIsEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedName) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; user?: { name?: string } }
        | null;

      if (!response.ok) {
        return;
      }

      const nextName = payload?.user?.name ?? normalizedName;
      setName(nextName);
      await update?.({ name: nextName });
      setIsEditing(false);
    } catch {
      return;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConnectGithub() {
    setGithubMessage(null);
    setGithubBusy(true);
    try {
      const providers = await getProviders();
      if (!providers?.github) {
        setGithubMessage(t("profile.githubOAuthNotConfigured"));
        return;
      }
      await signIn("github", {
        callbackUrl: "/settings/profile",
        /** Force GitHub to re-prompt so upgraded scopes (e.g. `repo`) are granted. */
        authorizationParams: { prompt: "consent" },
      });
    } catch {
      setGithubMessage(t("profile.couldNotStartGithub"));
    } finally {
      setGithubBusy(false);
    }
  }

  async function handleDisconnectGithub() {
    setGithubMessage(null);
    setGithubDisconnectBusy(true);
    try {
      const res = await fetch("/api/account/github", { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setGithubMessage(typeof payload?.error === "string" ? payload.error : "Disconnect failed.");
        return;
      }
      await router.replace(router.asPath);
    } finally {
      setGithubDisconnectBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            {isEditing ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  {t("profile.name")}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    placeholder={t("profile.yourNamePlaceholder")}
                    autoComplete="name"
                    maxLength={80}
                  />
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="shrink-0 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    {t("profile.name")}
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-foreground">
                    {savedName || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEditStart}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 transition hover:bg-muted hover:text-foreground"
                  aria-label={t("profile.editName")}
                  title={t("profile.editName")}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              {t("profile.email")}
            </p>
            <p className="mt-3 break-all text-sm font-medium text-foreground">
              {email}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            {t("profile.github")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {linkedGithub ? (
              <>
                <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {t("profile.connected")}
                </span>
                <button
                  type="button"
                  disabled={githubBusy}
                  onClick={() => void handleConnectGithub()}
                  className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {githubBusy ? t("profile.redirecting") : t("profile.reconnectPermissions")}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={githubBusy}
                onClick={() => void handleConnectGithub()}
                className="inline-flex items-center rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {githubBusy ? t("profile.redirecting") : t("profile.connectGitHub")}
              </button>
            )}
            {linkedGithub && canDisconnectGithub ? (
              <button
                type="button"
                disabled={githubDisconnectBusy}
                onClick={() => void handleDisconnectGithub()}
                className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {githubDisconnectBusy ? t("profile.disconnecting") : t("profile.disconnect")}
              </button>
            ) : null}
          </div>
          {linkedGithub && !canDisconnectGithub ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("profile.githubDisconnectHint")}
            </p>
          ) : null}
          {githubMessage ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {githubMessage}
            </p>
          ) : null}
        </div>
      </form>
  );
}

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) {
    return { notFound: true };
  }

  const providers = new Set(user.accounts.map((a) => a.provider));
  return {
    props: {
      linkedGoogle: providers.has("google"),
      linkedGithub: providers.has("github"),
      hasPassword: Boolean(user.passwordHash),
    },
  };
};
