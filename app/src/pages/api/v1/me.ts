import type { NextApiRequest, NextApiResponse } from "next";

import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, "GET")) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    return res.status(404).json({ error: "user_not_found" });
  }

  return res.status(200).json({
    user_id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt.toISOString(),
  });
}
