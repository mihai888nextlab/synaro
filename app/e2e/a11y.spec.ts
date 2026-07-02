import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

import { useEnglishLocale } from "./helpers/locale";

const authFile = path.join(__dirname, ".auth/user.json");
const emptyStorage = { cookies: [] as [], origins: [] as [] };

test.describe("Accessibility (guest)", () => {
  test.use({ storageState: emptyStorage });

  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("login page has no axe violations", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Accessibility (authenticated)", () => {
  test.use({ storageState: authFile });

  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("dashboard has no axe violations", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("global search dialog has no axe violations", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog")).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
