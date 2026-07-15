import { type Locale } from "@/i18n/config";

const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-US",
  ro: "ro-RO",
};

export function localeToBcp47(locale: Locale): string {
  return LOCALE_BCP47[locale];
}
