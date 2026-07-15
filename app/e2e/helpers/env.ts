import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "../..");

/** Load `.env` / `.env.local` into `process.env` for Playwright (without overwriting). */
export function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    const filePath = path.join(APP_ROOT, file);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function e2ePort(): number {
  return Number(process.env.PLAYWRIGHT_PORT ?? "3100");
}

export function e2eBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${e2ePort()}`;
}
