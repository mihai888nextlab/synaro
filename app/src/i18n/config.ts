export const LOCALES = ["en", "ro"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "synaro.locale";

export const LOCALE_STORAGE_KEY = "synaro.locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ro: "Română",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ro";
}
