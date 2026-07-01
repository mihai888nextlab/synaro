import { expect, test as setup } from "@playwright/test";
import path from "node:path";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./helpers/seed";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[name="email"]', E2E_USER_EMAIL);
  await page.fill('[name="password"]', E2E_USER_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.evaluate(() => {
    localStorage.setItem(
      "synaro:onboarding:completed",
      JSON.stringify({ v: 3, at: Date.now() }),
    );
  });

  await page.context().storageState({ path: authFile });
});
