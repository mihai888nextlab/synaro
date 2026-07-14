"use client";

import { Mic } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import {
  getVoiceInputCapability,
  useVoiceInputCapability,
} from "@/lib/speech/use-voice-input-capability";
import { cn } from "@/lib/utils";

type VoiceMicButtonProps = {
  isListening: boolean;
  busy?: boolean;
  onToggle: () => void;
  onUnsupported?: (message: string) => void;
  className?: string;
  sizeClassName?: string;
};

export function voiceInputUnsupportedMessage(
  t: (key: string) => string,
  capability: ReturnType<typeof getVoiceInputCapability>,
): string {
  if (capability.supported) return "";
  return capability.reason === "no-secure-context"
    ? t("aiChat.voiceRequiresSecureContext")
    : t("aiChat.voiceUnsupportedBrowser");
}

export function VoiceMicButton({
  isListening,
  busy = false,
  onToggle,
  onUnsupported,
  className,
  sizeClassName = "h-9 w-9",
}: VoiceMicButtonProps) {
  const { t } = useTranslation();
  const capability = useVoiceInputCapability();

  const handleClick = () => {
    if (!capability.supported) {
      onUnsupported?.(voiceInputUnsupportedMessage(t, capability));
      return;
    }
    onToggle();
  };

  const unsupportedTitle = capability.supported
    ? undefined
    : voiceInputUnsupportedMessage(t, capability);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={unsupportedTitle}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[28%] border border-border/70 bg-card/80 text-muted-foreground transition hover:bg-muted hover:text-foreground",
        sizeClassName,
        isListening && "border-primary/50 bg-primary/10 text-primary",
        !capability.supported && "opacity-75",
        busy && "pointer-events-none opacity-50",
        className,
      )}
      aria-label={isListening ? t("aiChat.stopVoice") : t("aiChat.startVoice")}
      aria-pressed={isListening}
    >
      <Mic className={cn("size-4", isListening && "animate-pulse")} />
    </button>
  );
}
