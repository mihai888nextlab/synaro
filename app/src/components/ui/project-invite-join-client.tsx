"use client";

import * as React from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export type ProjectInviteJoinClientProps = {
  token: string;
  projectName: string;
  projectSlug: string;
};

export function ProjectInviteJoinClient({ token, projectName, projectSlug }: ProjectInviteJoinClientProps) {
  const router = useRouter();
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
          setError("Invalid response from server.");
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
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }, [projectSlug, router, token]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Project invite</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited to collaborate on{" "}
          <span className="font-medium text-foreground">{projectName}</span>.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Checking session…</p>
      ) : status === "unauthenticated" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Sign in with your Synaro account to accept this invite.</p>
          <Button type="button" onClick={() => void signIn(undefined, { callbackUrl })}>
            Sign in to join
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button type="button" disabled={busy} onClick={() => void handleAccept()}>
            {busy ? "Joining…" : "Accept invite"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
