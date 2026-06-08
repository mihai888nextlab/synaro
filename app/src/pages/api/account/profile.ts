import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type ApiResponse =
  | { user: { id: string; name: string; email: string } }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>,
) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const rawName = typeof req.body?.name === "string" ? req.body.name : "";
  const name = rawName.trim().replace(/\s+/g, " ");

  if (!name) {
    return res.status(400).json({ error: "Name cannot be empty." });
  }

  if (name.length > 80) {
    return res.status(400).json({ error: "Name must be 80 characters or less." });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true },
  });

  return res.status(200).json({ user });
}
