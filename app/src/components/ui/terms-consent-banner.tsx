"use client";

import * as React from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/ui/locale-provider";
import { acceptTerms, hasAcceptedTerms } from "@/lib/terms-consent-storage";
import { cn } from "@/lib/utils";

const TERM_SECTION_KEYS = [
  "intro",
  "service",
  "thirdPartyOverview",
  "kimi",
  "brave",
  "elevenlabs",
  "oauth",
  "dataProcessing",
  "responsibilities",
  "liability",
  "changes",
  "contact",
] as const;

export function TermsConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = React.useState(false);
  const [termsOpen, setTermsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!hasAcceptedTerms()) {
      setVisible(true);
    }
  }, []);

  const handleAccept = React.useCallback(() => {
    acceptTerms();
    setVisible(false);
    setTermsOpen(false);
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        role="dialog"
        aria-labelledby="terms-consent-title"
        aria-describedby="terms-consent-summary"
        className={cn(
          "fixed bottom-4 right-4 z-[90] w-[min(100vw-2rem,22rem)]",
          "rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50">
            <FileText className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="terms-consent-title" className="text-sm font-semibold text-foreground">
              {t("termsConsent.bannerTitle")}
            </h2>
            <p id="terms-consent-summary" className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("termsConsent.bannerSummary")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" className="flex-1" onClick={handleAccept}>
            {t("termsConsent.accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => setTermsOpen(true)}
          >
            {t("termsConsent.readTerms")}
          </Button>
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent
          overlayClassName="bg-black/75 backdrop-blur-sm"
          className={cn(
            "flex max-h-[min(85vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
            "rounded-2xl border border-border bg-card text-card-foreground shadow-2xl",
          )}
        >
          <div className="shrink-0 border-b border-border bg-card px-5 py-4">
            <DialogTitle className="text-base font-semibold">{t("termsConsent.dialogTitle")}</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("termsConsent.lastUpdated")}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-card px-5 py-4">
            <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
              {TERM_SECTION_KEYS.map((key) => (
                <section key={key}>
                  <h3 className="mb-1.5 text-sm font-medium text-foreground">
                    {t(`termsConsent.sections.${key}.title`)}
                  </h3>
                  <p>{t(`termsConsent.sections.${key}.body`)}</p>
                </section>
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-card px-5 py-4">
            <Button type="button" className="w-full" onClick={handleAccept}>
              {t("termsConsent.accept")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
