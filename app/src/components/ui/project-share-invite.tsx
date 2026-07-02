"use client";

import * as React from "react";
import { Link2, Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export type ProjectShareInviteProps = {
  projectId: string;
};

export function ProjectShareInvite({ projectId }: ProjectShareInviteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setInviteUrl(null);
      setExpiresAt(null);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/invites`, {
          method: "POST",
          credentials: "include",
        });
        const raw = await res.text();
        let data: { inviteUrl?: string; expiresAt?: string; error?: string } = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as typeof data;
          } catch {
            if (!cancelled) setError(t("workspace.invalidServerResponse"));
            return;
          }
        }
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error ?? t("workspace.couldNotCreateLink", { status: res.status }));
          }
          return;
        }
        if (!cancelled) {
          setInviteUrl(data.inviteUrl ?? null);
          setExpiresAt(data.expiresAt ?? null);
        }
      } catch {
        if (!cancelled) setError(t("workspace.networkErrorShort"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, t]);

  const copy = React.useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      setError(t("workspace.couldNotCopyLink"));
    }
  }, [inviteUrl, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="size-3.5" />
          {t("workspace.share")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xl",
          "sm:max-w-md",
        )}
      >
        <DialogTitle className="sr-only">{t("workspace.projectInviteLink")}</DialogTitle>

        {loading ? (
          <div className="flex items-center gap-3 py-1 text-sm text-muted-foreground">
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            <span>{t("workspace.creatingInviteLink")}</span>
          </div>
        ) : inviteUrl ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("workspace.inviteLink")}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="h-10 font-mono text-xs"
                aria-label={t("workspace.inviteLinkAria")}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={() => void copy()}
                title={t("workspace.copyLink")}
              >
                <Link2 className="size-4" />
              </Button>
            </div>
            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                {t("workspace.expiresAt", { date: new Date(expiresAt).toLocaleString() })}
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
