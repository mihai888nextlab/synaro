const COMPLETED_KEY = "synaro:onboarding:completed";
const PENDING_KEY = "synaro:onboarding:pending";
/** Written on finish/skip. Older completed records (v >= 3) still count as done. */
const VERSION = 4;

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { v?: number };
    return typeof parsed.v === "number" && parsed.v >= 3;
  } catch {
    return false;
  }
}

export function markOnboardingCompleted() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify({ v: VERSION, at: Date.now() }));
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export function resetOnboardingCompleted() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(COMPLETED_KEY);
  } catch {
    // ignore
  }
}

export function setOnboardingPending() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeOnboardingPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = sessionStorage.getItem(PENDING_KEY) === "1";
    if (pending) sessionStorage.removeItem(PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
