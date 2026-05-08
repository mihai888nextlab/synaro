"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "synaro.theme.mode";

function getSystemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function subscribeToPrefersDark(onStoreChange: () => void) {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!media) return () => {};

  try {
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  } catch {
    media.addListener(onStoreChange);
    return () => media.removeListener(onStoreChange);
  }
}

function applyHtmlTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Trigger a short global transition so the whole UI shifts together.
  root.classList.add("theme-transition");
  root.classList.toggle("dark", resolved === "dark");
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;

  window.setTimeout(() => {
    root.classList.remove("theme-transition");
  }, 420);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {
      // ignore
    }
    return "system";
  });
  const prefersDark = useSyncExternalStore(
    subscribeToPrefersDark,
    () => getSystemPrefersDark(),
    () => false,
  );
  const resolvedMode: "light" | "dark" = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  useLayoutEffect(() => {
    applyHtmlTheme(resolvedMode);
  }, [resolvedMode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    const resolved: "light" | "dark" =
      next === "system" ? (getSystemPrefersDark() ? "dark" : "light") : next;
    applyHtmlTheme(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode }),
    [mode, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

