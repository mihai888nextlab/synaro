import type { Locale } from "@/i18n/config";

import { getElevenLabsConfig, voiceIdForLocale } from "@/lib/elevenlabs/config";
import { localeToElevenLabsLanguage } from "@/lib/elevenlabs/locale";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ElevenLabsApiError";
  }
}

export async function elevenLabsTextToSpeech(
  text: string,
  locale: Locale,
): Promise<ArrayBuffer> {
  const cfg = getElevenLabsConfig();
  const voiceId = voiceIdForLocale(locale);
  if (!cfg.apiKey || !voiceId) {
    throw new ElevenLabsApiError("ElevenLabs TTS is not configured.", 503);
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: cfg.ttsModel,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ElevenLabsApiError(
      detail || `ElevenLabs TTS failed (${res.status}).`,
      res.status,
    );
  }

  return res.arrayBuffer();
}

export async function elevenLabsSpeechToText(
  audio: Buffer,
  locale: Locale,
  mimeType: string,
): Promise<string> {
  const cfg = getElevenLabsConfig();
  if (!cfg.apiKey) {
    throw new ElevenLabsApiError("ElevenLabs STT is not configured.", 503);
  }

  const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "audio";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `recording.${extension}`);
  form.append("model_id", cfg.sttModel);
  form.append("language_code", localeToElevenLabsLanguage(locale));

  const res = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "xi-api-key": cfg.apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ElevenLabsApiError(
      detail || `ElevenLabs STT failed (${res.status}).`,
      res.status,
    );
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
