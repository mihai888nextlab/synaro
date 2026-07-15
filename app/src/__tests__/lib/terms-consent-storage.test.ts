import {
  TERMS_CONSENT_VERSION,
  acceptTerms,
  hasAcceptedTerms,
} from "@/lib/terms-consent-storage";

describe("terms-consent-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unaccepted", () => {
    expect(hasAcceptedTerms()).toBe(false);
  });

  it("persists acceptance with version", () => {
    acceptTerms();
    expect(hasAcceptedTerms()).toBe(true);
    const raw = localStorage.getItem("synaro:terms-accepted");
    expect(raw).toContain(TERMS_CONSENT_VERSION);
  });
});
