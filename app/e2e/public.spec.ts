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

  test("landing page exposes Open Graph meta tags", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Build and run software/i,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /synaro\.tech\/api\/og\?type=site/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });

  test("documentation page exposes doc-specific OG image", async ({ page }) => {
    await page.goto("/documentation");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /type=doc/,
    );
  });
});
