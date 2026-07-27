import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

const DEMO_DOMAIN = process.env.DEMO_EMAIL_DOMAIN?.trim() || "synaro.demo";

function genPassword(): string {
  // Readable-ish 12-char password to hand to a jury member.
  return `Demo-${randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  // GET — list demo accounts (by email domain) with their projects.
  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        projects: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, slug: true, environmentStatus: true },
        },
      },
    });
    return res.json({ accounts: users, demoDomain: DEMO_DOMAIN });
  }

  // POST — create a demo account. Returns the plaintext password ONCE.
  if (req.method === "POST") {
    const body = req.body as { name?: string; email?: string; password?: string };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Jury Demo";

    let email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : "";
    if (!email) {
      const count = await prisma.user.count({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
      email = `demo-${count + 1}@${DEMO_DOMAIN}`;
    }
    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const password = typeof body.password === "string" && body.password.length >= 6 ? body.password : genPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerified: new Date(), // pre-verified so the jury can sign in immediately
      },
      select: { id: true, name: true, email: true },
    });

    return res.status(201).json({ user, password });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
