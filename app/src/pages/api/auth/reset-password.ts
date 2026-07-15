import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";

import { consumeAuthToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const confirmPassword =
    typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (!token) return res.status(400).json({ error: "Missing token" });
  if (password.length < 8) return res.status(400).json({ error: "Password too short" });
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  const email = await consumeAuthToken(token, "reset");
  if (!email) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return res.status(400).json({ error: "Invalid or expired reset link" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashedPassword },
  });

  return res.status(200).json({ message: "Password updated. You can sign in now." });
}
