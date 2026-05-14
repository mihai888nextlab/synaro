import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import type { FormEvent } from "react";
import { useRouter } from "next/router";
import { Pencil } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { getServerSession } from "next-auth/next";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type ProfilePageProps = {
  linkedGoogle: boolean;
  linkedGithub: boolean;
  hasPassword: boolean;
};

function oauthErrorMessage(code: string): string {
  const map: Record<string, string> = {
    OAuthSignin: "Could not start sign-in with the provider.",
    OAuthCallback: "The provider rejected the sign-in callback.",
    OAuthCreateAccount: "Could not create an account from the provider response.",
    EmailCreateAccount: "Could not create an account with this email.",
    Callback: "Something went wrong during sign-in.",
    OAuthAccountNotLinked:
      "This sign-in is already used by another account, or the email does not match your Synaro email.",
    SessionRequired: "Please sign in.",
    AccessDenied: "Access was denied.",
    Default: "Sign-in failed. Try again.",
  };
  return map[code] ?? map.Default;
}

export default function ProfilePage({
  linkedGoogle: linkedGoogleInitial,
  linkedGithub: linkedGithubInitial,
  hasPassword,
}: ProfilePageProps) {
  const router = useRouter();
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
      setGithubMessage(oauthErrorMessage(code));
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
        setGithubMessage(
          "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the server.",
        );
        return;
      }
      await signIn("github", { callbackUrl: "/settings/profile" });
    } catch {
      setGithubMessage("Could not start GitHub sign-in.");
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
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            {isEditing ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  Name
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={80}
                  />
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="shrink-0 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Name
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-foreground">
                    {savedName || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEditStart}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 transition hover:bg-muted hover:text-foreground"
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Email
            </p>
            <p className="mt-3 break-all text-sm font-medium text-foreground">
              {email}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            GitHub
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect GitHub to sign in with GitHub and use the same email as this account. Your GitHub
            email must match <span className="font-medium text-foreground">{email}</span> (or be
            visible to the GitHub OAuth app). After connecting, use{" "}
            <span className="font-medium text-foreground">Projects → Import → My repositories</span>{" "}
            to choose a repo. If that list fails with a permission error, disconnect GitHub here and
            connect again so your token includes repository access.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {linkedGithub ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Connected
              </span>
            ) : (
              <button
                type="button"
                disabled={githubBusy}
                onClick={() => void handleConnectGithub()}
                className="inline-flex items-center rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {githubBusy ? "Redirecting…" : "Connect GitHub"}
              </button>
            )}
            {linkedGithub && canDisconnectGithub ? (
              <button
                type="button"
                disabled={githubDisconnectBusy}
                onClick={() => void handleDisconnectGithub()}
                className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {githubDisconnectBusy ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : null}
          </div>
          {linkedGithub && !canDisconnectGithub ? (
            <p className="mt-3 text-xs text-muted-foreground">
              To disconnect GitHub, add a password or connect Google first so you can still sign in.
            </p>
          ) : null}
          {githubMessage ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {githubMessage}
            </p>
          ) : null}
        </div>
      </form>
    </div>
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
