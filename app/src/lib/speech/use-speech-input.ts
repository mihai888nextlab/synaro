"use client";

import * as React from "react";

import { type Locale, isLocale } from "@/i18n/config";
import {
  canUseMicrophone,
  getSpeechRecognitionCtor,
  preferredRecorderMimeType,
  supportsRecordedSpeechInput,
  supportsSpeechRecognition,
} from "@/lib/speech/capabilities";

const DEFAULT_SILENCE_MS = 3000;

export type UseSpeechInputOptions = {
  disabled?: boolean;
  lang?: string;
  locale?: Locale;
  silenceMs?: number;
  onInterim?: (text: string) => void;
  onUtteranceEnd?: (text: string) => void;
  onError?: (message: string) => void;
};

function localeFromLang(lang?: string, locale?: Locale): Locale {
  if (locale) return locale;
  if (!lang) return "en";
  if (lang.toLowerCase().startsWith("ro")) return "ro";
  return "en";
}

function attachSilenceMonitor(
  stream: MediaStream,
  silenceMs: number,
  onSilence: () => void,
): () => void {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let raf = 0;
  let heardSpeech = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const scheduleSilence = () => {
    clearTimer();
    timer = setTimeout(() => {
      if (!cancelled && heardSpeech) onSilence();
    }, silenceMs);
  };

  const tick = () => {
    if (cancelled) return;
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    if (avg > 10) {
      heardSpeech = true;
      scheduleSilence();
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    clearTimer();
    cancelAnimationFrame(raf);
    void ctx.close();
  };
}

export function useSpeechInput({
  disabled = false,
  lang,
  locale: localeProp,
  silenceMs = DEFAULT_SILENCE_MS,
  onInterim,
  onUtteranceEnd,
  onError,
}: UseSpeechInputOptions) {
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const finalPartsRef = React.useRef<string[]>([]);
  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const silenceCleanupRef = React.useRef<(() => void) | null>(null);
  const recorderMimeRef = React.useRef<string>("audio/webm");
  const stoppingRef = React.useRef(false);

  const resolvedLocale = localeFromLang(lang, localeProp);

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current != null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const cleanupRecorded = React.useCallback(() => {
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  const stopRecorded = React.useCallback(
    (mode: "stop" | "abort" = "stop") => {
      const recorder = recorderRef.current;
      if (!recorder) {
        cleanupRecorded();
        setIsListening(false);
        return;
      }

      if (mode === "abort") {
        stoppingRef.current = true;
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {
          /* ignore */
        }
        cleanupRecorded();
        stoppingRef.current = false;
        setIsListening(false);
        return;
      }

      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        cleanupRecorded();
        setIsListening(false);
      }
    },
    [cleanupRecorded],
  );

  const stop = React.useCallback(
    (mode: "stop" | "abort" = "stop") => {
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
      if (recorderRef.current) {
        stopRecorded(mode);
        return;
      }
      setIsListening(false);
    },
    [clearSilenceTimer, stopRecorded],
  );

  const scheduleWebSpeechSilenceStop = React.useCallback(() => {
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

  const transcribeBlob = React.useCallback(
    async (blob: Blob, mimeType: string) => {
      const form = new FormData();
      form.append("audio", blob, mimeType.includes("webm") ? "recording.webm" : "recording.m4a");
      form.append("locale", resolvedLocale);

      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Transcription failed.");
      }

      const data = (await res.json()) as { text?: string };
      return data.text?.trim() ?? "";
    },
    [resolvedLocale],
  );

  const startRecorded = React.useCallback(async () => {
    const mimeType = preferredRecorderMimeType();
    if (!mimeType) {
      onError?.("Voice input is not supported in this browser.");
      return;
    }
    if (!canUseMicrophone()) {
      onError?.("Microphone requires HTTPS or localhost.");
      return;
    }

    stop("abort");
    stoppingRef.current = false;
    chunksRef.current = [];
    recorderMimeRef.current = mimeType;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        void (async () => {
          const wasAbort = stoppingRef.current;
          const blob = new Blob(chunksRef.current, { type: recorderMimeRef.current });
          cleanupRecorded();
          setIsListening(false);

          if (wasAbort) return;

          if (blob.size === 0) {
            onError?.("No speech detected.");
            onUtteranceEnd?.("");
            return;
          }

          try {
            onInterim?.("");
            const text = await transcribeBlob(blob, recorderMimeRef.current);
            if (text) onInterim?.(text);
            onUtteranceEnd?.(text);
          } catch (err) {
            onError?.(err instanceof Error ? err.message : "Transcription failed.");
            onUtteranceEnd?.("");
          }
        })();
      };

      recorder.onerror = () => {
        onError?.("Could not record audio.");
        stop("abort");
      };

      silenceCleanupRef.current = attachSilenceMonitor(stream, silenceMs, () => {
        stopRecorded("stop");
      });

      recorder.start(250);
      setIsListening(true);
    } catch {
      cleanupRecorded();
      onError?.("Microphone permission denied.");
      setIsListening(false);
    }
  }, [
    cleanupRecorded,
    onError,
    onInterim,
    onUtteranceEnd,
    silenceMs,
    stop,
    stopRecorded,
    transcribeBlob,
  ]);

  const startWebSpeech = React.useCallback(() => {
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
      if (display.length > 0) scheduleWebSpeechSilenceStop();
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
  }, [
    clearSilenceTimer,
    lang,
    onError,
    onInterim,
    onUtteranceEnd,
    scheduleWebSpeechSilenceStop,
    stop,
  ]);

  const start = React.useCallback(() => {
    if (disabled) return;
    if (supportsSpeechRecognition()) {
      startWebSpeech();
      return;
    }
    if (supportsRecordedSpeechInput()) {
      void startRecorded();
      return;
    }
    onError?.("Voice input is not supported in this browser.");
  }, [disabled, onError, startRecorded, startWebSpeech]);

  const toggle = React.useCallback(() => {
    if (isListening) stop("stop");
    else start();
  }, [isListening, start, stop]);

  React.useEffect(() => () => stop("abort"), [stop]);

  return { isListening, start, stop, toggle };
}

export function speechInputLocaleFromOptions(lang?: string, locale?: string): Locale {
  if (locale && isLocale(locale)) return locale;
  return localeFromLang(lang);
}
