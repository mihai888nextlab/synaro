"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, X } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { SpeechWaveform } from "@/components/ui/speech-waveform";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { localeToBcp47 } from "@/lib/speech/locale-bcp47";
import { useMicrophoneLevels } from "@/lib/speech/use-microphone-levels";
import { useSpeechInput } from "@/lib/speech/use-speech-input";
import { cn } from "@/lib/utils";

const MAX_INLINE_FILE_BYTES = 100_000;

export async function buildAgentRunInput(
  text: string,
  attachments: File[],
): Promise<string | undefined> {
  const parts: string[] = [];
  const trimmed = text.trim();
  if (trimmed) parts.push(trimmed);

  for (const file of attachments) {
    if (file.size > MAX_INLINE_FILE_BYTES) {
      parts.push(`\n\n[Attachment: ${file.name} — file too large to inline]`);
      continue;
    }
    try {
      const content = await file.text();
      parts.push(`\n\n--- ${file.name} ---\n${content.trim()}`);
    } catch {
      parts.push(`\n\n[Attachment: ${file.name}]`);
    }
  }

  const combined = parts.join("").trim();
  return combined || undefined;
}

type AgentRunComposerProps = {
  value: string;
  onChange: (value: string) => void;
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Set to true when the mic contributes transcript (even if user edits before submit). */
  voiceInitiatedRef?: React.MutableRefObject<boolean>;
  /** Called when the mic session ends (silence timeout or manual stop). */
  onVoiceUtteranceEnd?: (text: string) => void;
};

export function AgentRunComposer({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  disabled = false,
  placeholder,
  voiceInitiatedRef,
  onVoiceUtteranceEnd,
}: AgentRunComposerProps) {
  const { t, locale } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea(40, 160);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const markVoiceContribution = React.useCallback(
    (text: string) => {
      if (text.trim() && voiceInitiatedRef) voiceInitiatedRef.current = true;
    },
    [voiceInitiatedRef],
  );

  const { isListening, toggle: toggleVoice, stop: stopVoice } = useSpeechInput({
    disabled,
    lang: localeToBcp47(locale),
    locale,
    onInterim: (text) => {
      markVoiceContribution(text);
      onChange(text);
      adjustHeight();
    },
    onUtteranceEnd: (text) => {
      markVoiceContribution(text);
      if (text.trim()) {
        onChange(text.trim());
        adjustHeight();
      }
      onVoiceUtteranceEnd?.(text.trim());
    },
    onError: (msg) => {
      setVoiceError(msg);
      window.setTimeout(() => setVoiceError(null), 4000);
    },
  });

  const micLevels = useMicrophoneLevels(isListening);

  React.useEffect(() => {
    if (disabled && isListening) stopVoice();
  }, [disabled, isListening, stopVoice]);

  const openFilePicker = () => fileInputRef.current?.click();

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onAttachmentsChange([...attachments, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <AnimatePresence>
        {isListening ? (
          <motion.div
            className="border-b border-border/70 bg-primary/5 px-3 py-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <SpeechWaveform levels={micLevels} />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {t("aiChat.listeningHint")}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {voiceError ? (
        <p className="border-b border-border/70 px-3 py-2 text-center text-xs text-destructive">
          {voiceError}
        </p>
      ) : null}

      <AnimatePresence>
        {attachments.length > 0 ? (
          <motion.div
            className="border-b border-border/70 px-3 py-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, idx) => (
                <div
                  key={`${file.name}-${file.lastModified}-${idx}`}
                  className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <span className="max-w-[200px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("aiChat.removeAttachment")}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center self-stretch">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
            placeholder={isListening ? t("aiChat.listening") : placeholder}
            disabled={disabled || isListening}
            rows={1}
            className={cn(
              "block w-full min-h-10 resize-none bg-transparent py-0 text-sm leading-10 text-foreground",
              "placeholder:text-muted-foreground/60 focus:outline-none",
              (disabled || isListening) && "cursor-not-allowed opacity-50",
            )}
            style={{ overflow: "hidden" }}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <VoiceMicButton
            isListening={isListening}
            busy={disabled}
            onToggle={toggleVoice}
            onUnsupported={(msg) => {
              setVoiceError(msg);
              window.setTimeout(() => setVoiceError(null), 5000);
            }}
          />
          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled || isListening}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border/70 bg-card/80 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50",
            )}
            aria-label={t("aiChat.attachFile")}
          >
            <Paperclip className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
