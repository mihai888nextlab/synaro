import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

/** Returns the admin user's id, or null after sending a 401/403 response. */
export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const email =
    session.user?.email ??
    (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ??
    null;
  if (!isAdminEmail(email)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return userId;
}
