import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/** Browser language → `ro` if Romanian, otherwise fallback EN. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang.startsWith("ro")) return "ro";
  return DEFAULT_LOCALE;
}
