import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "e2e/.auth/user.json");

const guestSpecs = /(public|auth|documentation)\.spec\.ts/;
const authenticatedSpecs = /(settings|dashboard|projects|project-workspace|agents)\.spec\.ts/;

const browsers = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] },
] as const;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
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
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
