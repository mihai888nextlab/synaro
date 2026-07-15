import type { Page } from "@playwright/test";

const LOCALE_COOKIE = "synaro.locale";

/** Force English UI so E2E selectors stay stable across i18n. */
export async function useEnglishLocale(page: Page) {
  await page.context().addCookies([
    {
      name: LOCALE_COOKIE,
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("synaro.locale", "en");
    document.documentElement.lang = "en";
  });
}

/** Primary submit on the login / signup form (locale-agnostic). */
export function loginSubmitButton(page: Page) {
  return page.locator('form button[type="submit"]').first();
}
