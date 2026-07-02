"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "@/i18n/config";
import { detectBrowserLocale } from "@/i18n/detect-locale";
import { localeCookieValue } from "@/i18n/locale-cookie";
import { getMessages, type Messages } from "@/i18n/messages";
import { translate } from "@/i18n/translate";

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistClientLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = localeCookieValue(locale);
  } catch {
    // ignore
  }
}

function resolveClientLocale(initialLocale: Locale, sessionLocale?: string | null): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (isLocale(sessionLocale)) return sessionLocale;
  if (isLocale(initialLocale)) return initialLocale;
  return detectBrowserLocale();
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const { data: session, status, update } = useSession();
  const sessionLocale = session?.user?.preferredLocale;
  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveClientLocale(initialLocale, sessionLocale),
  );

  useEffect(() => {
    if (status !== "authenticated" || !isLocale(sessionLocale)) return;
    setLocaleState(sessionLocale);
    persistClientLocale(sessionLocale);
  }, [status, sessionLocale]);

  useEffect(() => {
    persistClientLocale(locale);
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      persistClientLocale(next);

      if (status === "authenticated") {
        try {
          await fetch("/api/account/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredLocale: next }),
          });
          await update({ preferredLocale: next });
        } catch {
          // keep local preference even if sync fails
        }
      }
    },
    [status, update],
  );

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(messages, key, params),
    [messages],
  );

  const value = useMemo(
    () => ({ locale, messages, setLocale, t }),
    [locale, messages, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale } = useLocale();
  return { t, locale };
}
