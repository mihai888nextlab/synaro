import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_NAME } from "./helpers/seed";
import { useEnglishLocale } from "./helpers/locale";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("profile shows user email and supports name edit", async ({ page }) => {
    await page.goto("/settings/profile");
    const main = page.getByRole("main");
    await expect(main.getByText(E2E_USER_EMAIL)).toBeVisible();
    await expect(main.getByText(E2E_USER_NAME)).toBeVisible();

    await main.getByRole("button", { name: "Edit name" }).click();
    await main.getByPlaceholder("Your name").fill("E2E Renamed User");
    await main.getByRole("button", { name: "Save" }).click();
    await expect(main.getByText("E2E Renamed User")).toBeVisible();
  });

  test("API keys — create, show secret once, list prefix", async ({ page }) => {
    await page.goto("/settings/api-keys");

    await page.getByLabel("Key name").fill("Playwright E2E Key");
    await page.getByRole("button", { name: "Create key" }).click();

    await expect(page.getByText("Copy your new API key")).toBeVisible();
    const secretBanner = page.locator("code.break-all");
    await expect(secretBanner).toHaveText(/sk_live_/);

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Playwright E2E Key")).toBeVisible();
    await expect(page.locator("ul code").filter({ hasText: /^sk_live_/ })).toBeVisible();
  });
});
