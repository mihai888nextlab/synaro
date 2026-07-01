import { execSync } from "node:child_process";

import { seedE2eDatabase } from "./helpers/seed";

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Playwright E2E (global-setup).");
  }

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  await seedE2eDatabase();
}
