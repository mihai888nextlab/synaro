import { test as setup } from "@playwright/test";
import path from "node:path";

import { loginAsE2eUser } from "./helpers/locale";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  await loginAsE2eUser(page);

  await page.evaluate(() => {
    localStorage.setItem(
      "synaro:onboarding:completed",
      JSON.stringify({ v: 3, at: Date.now() }),
    );
  });

  await page.context().storageState({ path: authFile });
});
