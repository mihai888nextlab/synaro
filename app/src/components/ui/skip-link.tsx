"use client";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export function SkipLink({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <a
      href="#main-content"
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]",
        "focus:rounded-lg focus:border focus:border-border focus:bg-card focus:px-4 focus:py-2",
        "focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg",
        className,
      )}
    >
      {t("a11y.skipToContent")}
    </a>
  );
}
