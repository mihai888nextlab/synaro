"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/components/ui/locale-provider";
import { absoluteUrl } from "@/lib/seo/site-metadata";
import { cn } from "@/lib/utils";

export type AgentShareLinkProps = {
  agentId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, only the dialog is rendered (no Share button trigger). */
  hideTrigger?: boolean;
};

export function AgentShareLink({
  agentId,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: AgentShareLinkProps) {
  const { t } = useTranslation();
  const [openUncontrolled, setOpenUncontrolled] = React.useState(false);
  const open = openProp ?? openUncontrolled;
  const setOpen = onOpenChange ?? setOpenUncontrolled;
  const [copied, setCopied] = React.useState(false);
  const shareUrl = absoluteUrl(`/a/${encodeURIComponent(agentId)}`);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Link2 className="size-3.5" />
            {t("agentShare.share")}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xl",
          "sm:max-w-md",
        )}
      >
        <DialogTitle className="text-base font-semibold text-foreground">
          {t("agentShare.shareTitle")}
        </DialogTitle>
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("agentShare.publicLink")}
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="h-10 font-mono text-xs"
              aria-label={t("agentShare.publicLinkAria")}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="shrink-0"
              onClick={() => void copy()}
              title={copied ? t("agentShare.copied") : t("agentShare.copyLink")}
              aria-label={copied ? t("agentShare.copied") : t("agentShare.copyLink")}
            >
              {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
