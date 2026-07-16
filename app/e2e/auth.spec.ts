import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL } from "./helpers/seed";
import { acceptTermsIfNeeded, loginAsE2eUser, loginSubmitButton, useEnglishLocale } from "./helpers/locale";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_USER_EMAIL);
    await page.fill('[name="password"]', "wrong-password-99");
    await loginSubmitButton(page).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("logs in with valid credentials", async ({ page }) => {
    await loginAsE2eUser(page);
  });

  test("signup shows check-email screen without logging in", async ({ page }) => {
    const email = `signup-e2e-${Date.now()}@synaro.test`;
    await page.goto("/signup");
    await page.fill('[name="fullName"]', "E2E Signup User");
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', "e2e-signup-password-12");
    await page.fill('[name="confirmPassword"]', "e2e-signup-password-12");
    await acceptTermsIfNeeded(page);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page).toHaveURL("/signup");
  });

  test("redirects unauthenticated users from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
