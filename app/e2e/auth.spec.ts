import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./helpers/seed";

test.describe("Authentication", () => {
  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_USER_EMAIL);
    await page.fill('[name="password"]', "wrong-password-99");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("logs in with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_USER_EMAIL);
    await page.fill('[name="password"]', E2E_USER_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
  });

  test("redirects unauthenticated users from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
