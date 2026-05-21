"use client";

import * as React from "react";

import { canUseMicrophone, getSpeechRecognitionCtor } from "@/lib/speech/capabilities";

const DEFAULT_SILENCE_MS = 3000;

export type UseSpeechInputOptions = {
  disabled?: boolean;
  lang?: string;
  /** Stop recognition after this many ms without new speech (default 3000). */
  silenceMs?: number;
  /** Called with interim transcript while the user is still speaking. */
  onInterim?: (text: string) => void;
  /** Called once when recognition ends with the final transcript (may be empty). */
  onUtteranceEnd?: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechInput({
  disabled = false,
  lang,
  silenceMs = DEFAULT_SILENCE_MS,
  onInterim,
  onUtteranceEnd,
  onError,
}: UseSpeechInputOptions) {
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const finalPartsRef = React.useRef<string[]>([]);
  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current != null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const scheduleSilenceStop = React.useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      const rec = recognitionRef.current;
      if (!rec) return;
      try {
        rec.stop();
      } catch {
        /* onend may still run */
      }
    }, silenceMs);
  }, [clearSilenceTimer, silenceMs]);

  const stop = React.useCallback((mode: "stop" | "abort" = "stop") => {
    clearSilenceTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        if (mode === "abort") rec.abort();
        else rec.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const start = React.useCallback(() => {
    if (disabled) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.("Voice input is not supported in this browser.");
      return;
    }
    if (!canUseMicrophone()) {
      onError?.("Microphone requires HTTPS or localhost.");
      return;
    }

    stop("abort");
    finalPartsRef.current = [];

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finals.push(text);
        else interim += text;
      }
      if (finals.length > 0) {
        finalPartsRef.current.push(...finals);
      }
      const combinedFinal = finalPartsRef.current.join(" ").trim();
      const display = [combinedFinal, interim.trim()].filter(Boolean).join(" ").trim();
      onInterim?.(display);
      if (display.length > 0) scheduleSilenceStop();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      const msg =
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : event.error === "no-speech"
            ? "No speech detected."
            : `Voice input error: ${event.error}`;
      onError?.(msg);
      stop("abort");
    };

    recognition.onend = () => {
      clearSilenceTimer();
      recognitionRef.current = null;
      setIsListening(false);
      const text = finalPartsRef.current.join(" ").trim();
      finalPartsRef.current = [];
      onUtteranceEnd?.(text);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      onError?.("Could not start voice recognition.");
      stop("abort");
    }
  }, [clearSilenceTimer, disabled, lang, onError, onInterim, onUtteranceEnd, scheduleSilenceStop, stop]);

  const toggle = React.useCallback(() => {
    if (isListening) stop("stop");
    else start();
  }, [isListening, start, stop]);

  React.useEffect(() => () => stop("abort"), [stop]);

  return { isListening, start, stop, toggle };
}
