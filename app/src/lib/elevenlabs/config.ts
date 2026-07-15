import type { Locale } from "@/i18n/config";

export type ElevenLabsConfig = {
  apiKey: string;
  ttsModel: string;
  sttModel: string;
  voiceIdEn: string | null;
  voiceIdRo: string | null;
};

export function getElevenLabsConfig(): ElevenLabsConfig {
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() ?? "",
    ttsModel: process.env.ELEVENLABS_TTS_MODEL?.trim() || "eleven_multilingual_v2",
    sttModel: process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2",
    voiceIdEn: process.env.ELEVENLABS_VOICE_ID_EN?.trim() || null,
    voiceIdRo: process.env.ELEVENLABS_VOICE_ID_RO?.trim() || null,
  };
}

export function isElevenLabsConfigured(): boolean {
  return getElevenLabsConfig().apiKey.length > 0;
}

export function isElevenLabsTtsConfigured(): boolean {
  const cfg = getElevenLabsConfig();
  return cfg.apiKey.length > 0 && Boolean(cfg.voiceIdEn || cfg.voiceIdRo);
}

export function voiceIdForLocale(locale: Locale): string | null {
  const cfg = getElevenLabsConfig();
  if (locale === "ro") return cfg.voiceIdRo ?? cfg.voiceIdEn;
  return cfg.voiceIdEn ?? cfg.voiceIdRo;
}
