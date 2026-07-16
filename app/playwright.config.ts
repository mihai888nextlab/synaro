import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

import { e2eBaseUrl, e2ePort, loadEnvFiles } from "./e2e/helpers/env";

loadEnvFiles();

const authFile = path.join(__dirname, "e2e/.auth/user.json");
const port = e2ePort();
const baseURL = e2eBaseUrl();

const guestSpecs = /(public|auth|documentation)\.spec\.ts/;
const authenticatedSpecs = /(settings|dashboard|projects|project-workspace|agents|global-search)\.spec\.ts/;

const browsers = process.env.CI
  ? ([{ name: "chromium", use: devices["Desktop Chrome"] }] as const)
  : ([
      { name: "chromium", use: devices["Desktop Chrome"] },
      { name: "firefox", use: devices["Desktop Firefox"] },
      { name: "webkit", use: devices["Desktop Safari"] },
    ] as const);

const webServerCommand = process.env.CI
  ? `PORT=${port} npm run start`
  : `PORT=${port} npm run build && PORT=${port} npm run start`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    ...browsers.flatMap((browser) => [
      {
        name: `guest-${browser.name}`,
        testMatch: guestSpecs,
        dependencies: ["setup"],
        use: { ...browser.use },
      },
      {
        name: `authenticated-${browser.name}`,
        testMatch: authenticatedSpecs,
        use: {
          ...browser.use,
          storageState: authFile,
        },
        dependencies: ["setup"],
      },
    ]),
    {
      name: "a11y-chromium",
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: String(port),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? baseURL,
    },
  },
});
