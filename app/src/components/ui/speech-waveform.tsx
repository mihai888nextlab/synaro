"use client";

import { motion } from "framer-motion";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

type SpeechWaveformProps = {
  levels: number[];
  className?: string;
};

/** Live bar waveform driven by microphone frequency data (0–1 per bar). */
export function SpeechWaveform({ levels, className }: SpeechWaveformProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn("flex h-12 items-center justify-center gap-[3px] px-2", className)}
      role="img"
      aria-label={t("a11y.listening")}
    >
      {levels.map((level, i) => (
        <motion.div
          key={i}
          className="w-[3px] shrink-0 rounded-full bg-primary/80"
          animate={{ height: `${Math.round(8 + level * 32)}px` }}
          transition={{ type: "spring", stiffness: 380, damping: 28, mass: 0.4 }}
        />
      ))}
    </div>
  );
}
