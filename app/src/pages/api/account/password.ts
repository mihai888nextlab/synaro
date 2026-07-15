import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";

type PasswordResponse = { ok: true } | { error: string };

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PasswordResponse>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return res.status(404).json({ error: "User not found." });

  if (user.passwordHash) {
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required." });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(403).json({ error: "Current password is incorrect." });
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return res.status(200).json({ ok: true });
}
