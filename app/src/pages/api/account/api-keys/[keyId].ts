import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keyId = typeof req.query.keyId === "string" ? req.query.keyId : "";
  if (!keyId) return res.status(400).json({ error: "Missing keyId" });

  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, userId, revokedAt: null },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "API key not found" });

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return res.status(204).end();
  } catch (err) {
    console.error("[api/account/api-keys/[keyId]]", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: "Failed to revoke API key",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}
