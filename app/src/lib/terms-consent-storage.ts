/** Bump when terms text changes materially — prompts re-acceptance in the browser. */
export const TERMS_CONSENT_VERSION = "2";

const STORAGE_KEY = "synaro:terms-accepted";

type TermsConsentRecord = {
  version: string;
  acceptedAt: string;
};

export function hasAcceptedTerms(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as TermsConsentRecord;
    return parsed.version === TERMS_CONSENT_VERSION && Boolean(parsed.acceptedAt);
  } catch {
    return false;
  }
}

export function acceptTerms(): void {
  if (typeof window === "undefined") return;
  try {
    const record: TermsConsentRecord = {
      version: TERMS_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore quota / private mode
  }
}
