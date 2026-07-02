import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function parseLocaleCookie(cookieHeader: string | undefined): Locale | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isLocale(value) ? value : null;
}

export function localeCookieValue(locale: Locale): string {
  return `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${ONE_YEAR_SEC}; SameSite=Lax`;
}

export function resolveInitialLocale(cookieHeader: string | undefined): Locale {
  return parseLocaleCookie(cookieHeader) ?? DEFAULT_LOCALE;
}
