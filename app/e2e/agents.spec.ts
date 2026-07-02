import { expect, test } from "@playwright/test";

import { useEnglishLocale } from "./helpers/locale";

test.describe("Agents", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("loads agents page with empty list", async ({ page }) => {
    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/agents", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeAttached();
    await expect(page.getByText("+ New agent")).toBeVisible();
    await expect(page.locator('[data-onboarding="agents-grid"]')).toBeVisible();
  });
});
