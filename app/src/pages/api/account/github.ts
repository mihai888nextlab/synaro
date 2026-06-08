import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type Ok = { ok: true };
type Err = { error: string };

/**
 * Unlink the GitHub OAuth account from the signed-in user.
 * Blocked if GitHub is the only way to sign in (no password and no other OAuth).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const hasGithub = user.accounts.some((a) => a.provider === "github");
  if (!hasGithub) {
    return res.status(400).json({ error: "GitHub is not connected." });
  }

  const hasOtherOAuth = user.accounts.some((a) => a.provider !== "github");
  const hasPassword = Boolean(user.passwordHash);
  if (!hasPassword && !hasOtherOAuth) {
    return res.status(403).json({
      error:
        "Add a password or connect Google before disconnecting GitHub, so you can still sign in.",
    });
  }

  await prisma.account.deleteMany({ where: { userId, provider: "github" } });
  return res.status(200).json({ ok: true });
}
