import { expect, test } from "@playwright/test";

import {
  E2E_ACTIVITY_ACTION,
  E2E_PROJECT_PRIMARY_NAME,
  E2E_PROJECT_SECONDARY_NAME,
} from "./helpers/seed";
import { useEnglishLocale } from "./helpers/locale";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglishLocale(page);
  });

  test("shows seeded projects and activity", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Open project: ${E2E_PROJECT_PRIMARY_NAME}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Open project: ${E2E_PROJECT_SECONDARY_NAME}` }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible();
    await expect(page.getByText("+ New agent")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByRole("cell", { name: E2E_ACTIVITY_ACTION })).toBeVisible();
  });

  test("links to full projects list", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "View all" }).first().click();
    await expect(page).toHaveURL("/projects");
  });

  test("links to agents page from agents section", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .locator('[data-onboarding="dashboard-agents"]')
      .getByRole("link", { name: "View all" })
      .click();
    await expect(page).toHaveURL("/agents");
  });
});
