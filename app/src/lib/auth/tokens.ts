import crypto from "crypto";

import { prisma } from "@/lib/prisma";

export type AuthTokenPurpose = "verify" | "reset";

const TTL_MS: Record<AuthTokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

export function hashAuthToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function tokenIdentifier(email: string, purpose: AuthTokenPurpose): string {
  return `${purpose}:${email.toLowerCase().trim()}`;
}

export async function createAuthToken(
  email: string,
  purpose: AuthTokenPurpose,
): Promise<string> {
  const identifier = tokenIdentifier(email, purpose);
  const plain = generateAuthToken();
  const hashed = hashAuthToken(plain);
  const expires = new Date(Date.now() + TTL_MS[purpose]);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashed, expires },
  });

  return plain;
}

export async function consumeAuthToken(
  plain: string,
  purpose: AuthTokenPurpose,
): Promise<string | null> {
  const hashed = hashAuthToken(plain);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });

  if (!record || !record.identifier.startsWith(`${purpose}:`)) {
    return null;
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: hashed } }).catch(() => {});
    return null;
  }

  const email = record.identifier.slice(purpose.length + 1);
  await prisma.verificationToken.delete({ where: { token: hashed } });
  return email;
}
