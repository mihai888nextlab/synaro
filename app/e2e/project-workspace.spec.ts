import { expect, test } from "@playwright/test";

import { E2E_PROJECT_PRIMARY_SLUG } from "./helpers/seed";
import { useEnglishLocale } from "./helpers/locale";

test.describe("Project workspace", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("workspace shell shows main tabs", async ({ page }) => {
    await page.goto(`/projects/${E2E_PROJECT_PRIMARY_SLUG}`);

    await expect(page.getByRole("button", { name: "AI chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "File tree" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Terminal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deployments" })).toBeVisible();
  });

  test("can switch to file tree tab", async ({ page }) => {
    await page.goto(`/projects/${E2E_PROJECT_PRIMARY_SLUG}`);
    await page.getByRole("button", { name: "File tree" }).click();
    await expect(page.getByText(/Connect to a project|Loading file list|Start the runtime/i)).toBeVisible();
  });
});
