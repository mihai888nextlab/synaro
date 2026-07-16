"use client";

import * as React from "react";

import { useLocale } from "@/components/ui/locale-provider";
import { localeToBcp47 } from "@/lib/speech/locale-bcp47";
import { plainTextForSpeech } from "@/lib/speech/plain-text-for-speech";

const CHUNK_MAX_CHARS = 280;
const API_CHUNK_MAX_CHARS = 3_500;

type SpeechOutputContextValue = {
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
};

const SpeechOutputContext = React.createContext<SpeechOutputContextValue | null>(null);

function chunkForSpeech(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let rest = text;

  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      chunks.push(rest);
      break;
    }

    let splitAt = rest.lastIndexOf(". ", maxLen);
    if (splitAt < maxLen * 0.4) splitAt = rest.lastIndexOf(" ", maxLen);
    if (splitAt < maxLen * 0.4) splitAt = maxLen;

    const chunk = rest.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    rest = rest.slice(splitAt).trim();
  }

  return chunks.length > 0 ? chunks : [text];
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

function playAudioBlob(
  blob: Blob,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isCancelled()) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio playback failed."));
    };

    void audio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

export function SpeechOutputProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const chunksRef = React.useRef<string[]>([]);
  const chunkIndexRef = React.useRef(0);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const cancelledRef = React.useRef(false);

  const stop = React.useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }

    const synth = getSpeechSynthesis();
    synth?.cancel();
    utteranceRef.current = null;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const speakNextBrowserChunkRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    speakNextBrowserChunkRef.current = () => {
      const synth = getSpeechSynthesis();
      if (!synth || cancelledRef.current) {
        setIsSpeaking(false);
        return;
      }

      const index = chunkIndexRef.current;
      const chunk = chunksRef.current[index];
      if (!chunk) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = localeToBcp47(locale);
      utteranceRef.current = utterance;

      utterance.onend = () => {
        chunkIndexRef.current += 1;
        if (chunkIndexRef.current >= chunksRef.current.length || cancelledRef.current) {
          utteranceRef.current = null;
          setIsSpeaking(false);
          return;
        }
        speakNextBrowserChunkRef.current();
      };

      utterance.onerror = () => {
        utteranceRef.current = null;
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    };
  }, [locale]);

  const speakWithBrowser = React.useCallback((plain: string) => {
    const synth = getSpeechSynthesis();
    if (!synth || !plain) return;

    chunksRef.current = chunkForSpeech(plain, CHUNK_MAX_CHARS);
    chunkIndexRef.current = 0;
    setIsSpeaking(true);
    speakNextBrowserChunkRef.current();
  }, []);

  const speakChunkViaApi = React.useCallback(
    async (chunk: string, signal: AbortSignal) => {
      const res = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, locale }),
        signal,
      });
      if (!res.ok) throw new Error("TTS API failed");
      return res.blob();
    },
    [locale],
  );

  const speakWithElevenLabs = React.useCallback(
    async (plain: string) => {
      const chunks = chunkForSpeech(plain, API_CHUNK_MAX_CHARS);
      const controller = new AbortController();
      abortRef.current = controller;

      for (const chunk of chunks) {
        if (cancelledRef.current) return;
        const blob = await speakChunkViaApi(chunk, controller.signal);
        if (cancelledRef.current) return;
        await playAudioBlob(blob, audioRef, () => cancelledRef.current);
      }
    },
    [speakChunkViaApi],
  );

  const speak = React.useCallback(
    (text: string) => {
      const plain = plainTextForSpeech(text);
      if (!plain) return;

      stop();
      cancelledRef.current = false;
      setIsSpeaking(true);

      void (async () => {
        try {
          await speakWithElevenLabs(plain);
          if (!cancelledRef.current) setIsSpeaking(false);
        } catch (err) {
          if (cancelledRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          speakWithBrowser(plain);
        }
      })();
    },
    [speakWithBrowser, speakWithElevenLabs, stop],
  );

  React.useEffect(() => () => stop(), [stop]);

  const value = React.useMemo(
    () => ({ isSpeaking, speak, stop }),
    [isSpeaking, speak, stop],
  );

  return <SpeechOutputContext.Provider value={value}>{children}</SpeechOutputContext.Provider>;
}

export function useSpeechOutput() {
  const ctx = React.useContext(SpeechOutputContext);
  if (!ctx) {
    throw new Error("useSpeechOutput must be used within SpeechOutputProvider");
  }
  return ctx;
}
