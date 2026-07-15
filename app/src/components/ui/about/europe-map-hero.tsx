"use client";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Timișoara position in `public/about/europe-outline.svg` viewBox space
 * (generated from Highcharts europe geodata).
 */
const TIMISOARA_X_PERCENT = 61.6;
const TIMISOARA_Y_PERCENT = 68.5;

type EuropeMapHeroProps = {
  className?: string;
};

export function EuropeMapHero({ className }: EuropeMapHeroProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative mx-auto w-full max-w-4xl", className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950/80 to-black sm:aspect-[16/10]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_62%_68%,rgba(251,191,36,0.14),transparent_50%)]"
          aria-hidden
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/about/europe-outline.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-2 sm:p-4"
          draggable={false}
        />

        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${TIMISOARA_X_PERCENT}%`,
            top: `${TIMISOARA_Y_PERCENT}%`,
          }}
        >
          <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/25 motion-safe:animate-ping" />
          <span className="relative block size-3 rounded-full border border-amber-100/90 bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)] motion-safe:animate-pulse" />
          <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.2em] text-amber-200/95 sm:text-xs">
            {t("about.hero.cityLabel")}
          </span>
        </div>
      </div>
    </div>
  );
}
