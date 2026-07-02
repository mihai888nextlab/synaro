"use client";

import * as React from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/ui/locale-provider";

export type ProjectInviteJoinClientProps = {
  token: string;
  projectName: string;
  projectSlug: string;
};

export function ProjectInviteJoinClient({ token, projectName, projectSlug }: ProjectInviteJoinClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { status } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const callbackUrl = `/projects/invite/${encodeURIComponent(token)}`;

  const handleAccept = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      });
      const raw = await res.text();
      let data: { ok?: boolean; slug?: string; error?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setError(t("workspace.invalidServerResponse"));
          return;
        }
      }
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const slug = data.slug ?? projectSlug;
      await router.push(`/projects/${encodeURIComponent(slug)}`);
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setBusy(false);
    }
  }, [projectSlug, router, t, token]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("workspace.inviteTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("workspace.inviteBody", { projectName })}
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("workspace.checkingSession")}</p>
      ) : status === "unauthenticated" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("workspace.signInToJoin")}</p>
          <Button type="button" onClick={() => void signIn(undefined, { callbackUrl })}>
            {t("workspace.signInToJoinButton")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button type="button" disabled={busy} onClick={() => void handleAccept()}>
            {busy ? t("workspace.joining") : t("workspace.acceptInvite")}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
