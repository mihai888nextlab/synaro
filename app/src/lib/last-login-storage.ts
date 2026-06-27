export type LastLoginMethod = "email" | "google" | "github";

const STORAGE_KEY = "synaro:last-login-method";

export function getLastLoginMethod(): LastLoginMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "email" || raw === "google" || raw === "github") return raw;
    return null;
  } catch {
    return null;
  }
}

export function setLastLoginMethod(method: LastLoginMethod): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // ignore
  }
}
