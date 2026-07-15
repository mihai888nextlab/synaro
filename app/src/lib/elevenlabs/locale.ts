import type { Locale } from "@/i18n/config";

/** ElevenLabs Scribe language codes (ISO 639-3). */
const ELEVENLABS_LANGUAGE: Record<Locale, string> = {
  en: "eng",
  ro: "ron",
};

export function localeToElevenLabsLanguage(locale: Locale): string {
  return ELEVENLABS_LANGUAGE[locale];
}
