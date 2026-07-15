import { expect, test } from "@playwright/test";

import { useEnglishLocale } from "./helpers/locale";

test.describe("Documentation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("sidebar search filters pages", async ({ page }) => {
    await page.goto("/documentation");
    const search = page.getByLabel("Search documentation");
    await search.fill("spin up your first project");
    await expect(page.getByRole("link", { name: "Getting started" })).toBeVisible();
    await expect(page.getByRole("link", { name: "What is Synaro?" })).toHaveCount(0);
  });

  test("sidebar search navigates with keyboard", async ({ page }) => {
    await page.goto("/documentation");
    const search = page.getByLabel("Search documentation");
    await search.fill("spin up your first project");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/documentation\/getting-started$/);
    await expect(page.getByRole("heading", { name: "Getting started" })).toBeVisible();
  });

  test("public API doc shows copyable code example", async ({ page }) => {
    await page.goto("/documentation/public-api");
    await expect(page.getByText("Verify your key")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy code to clipboard" }).first()).toBeEnabled();
    await expect(page.locator("pre code").filter({ hasText: "Authorization: Bearer" }).first()).toBeVisible();
  });
});
