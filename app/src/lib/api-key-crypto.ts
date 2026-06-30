import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "sk_live_";

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  const raw = `${API_KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, API_KEY_PREFIX.length + 8);
  return { raw, prefix, hash: hashApiKey(raw) };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
