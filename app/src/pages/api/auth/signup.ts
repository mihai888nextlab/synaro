import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { trialEndDate } from "@/lib/billing/entitlements";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { fullName, email, password, confirmPassword } = req.body ?? {};

  if (
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes("@")) return res.status(400).json({ error: "Invalid email" });
  if (password.length < 8) return res.status(400).json({ error: "Password too short" });
  if (password !== confirmPassword)
    return res.status(400).json({ error: "Passwords do not match" });

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email: cleanEmail,
      name: fullName.trim(),
      passwordHash: hashedPassword,
      trialEndsAt: trialEndDate(),
    },
    select: { id: true, email: true, name: true },
  });

  return res.status(201).json({ message: "User created successfully" });
}

