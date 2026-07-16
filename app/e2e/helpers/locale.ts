import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./seed";

const LOCALE_COOKIE = "synaro.locale";

/** Force English UI so E2E selectors stay stable across i18n. */
export async function useEnglishLocale(page: Page) {
  await page.context().addInitScript(() => {
    localStorage.setItem("synaro.locale", "en");
    document.documentElement.lang = "en";
    // Keep in sync with TERMS_CONSENT_VERSION in terms-consent-storage.ts
    localStorage.setItem(
      "synaro:terms-accepted",
      JSON.stringify({ version: "2", acceptedAt: new Date().toISOString() }),
    );
  });
  await page.context().addCookies([
    {
      name: LOCALE_COOKIE,
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    },
  ]);
}

/** Primary submit on the login / signup form (locale-agnostic). */
export function loginSubmitButton(page: Page) {
  return page.locator('form button[type="submit"]').first();
}

export async function acceptTermsIfNeeded(page: Page) {
  const agree = page.getByRole("button", { name: "I agree" });
  if (await agree.isVisible().catch(() => false)) {
    await agree.click();
  }
}

export async function loginAsE2eUser(page: Page) {
  await useEnglishLocale(page);
  await page.goto("/login");
  await acceptTermsIfNeeded(page);
  await page.fill('[name="email"]', E2E_USER_EMAIL);
  await page.fill('[name="password"]', E2E_USER_PASSWORD);
  await loginSubmitButton(page).click();
  await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
}
