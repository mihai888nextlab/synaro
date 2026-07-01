import { expect, test } from "@playwright/test";

test.describe("Public pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Build and run software/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the docs" })).toBeVisible();
  });

  test("documentation page loads", async ({ page }) => {
    await page.goto("/documentation");
    await expect(page.getByRole("heading", { name: "What is Synaro?" })).toBeVisible();
    await expect(page.getByLabel("Search documentation")).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Flexible pricing for every stage." })).toBeVisible();
  });
});
