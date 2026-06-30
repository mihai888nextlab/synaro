import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { generateApiKey } from "@/lib/api-key-crypto";
import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { serializeApiKey } from "@/lib/public-api/serialize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const keys = await prisma.apiKey.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      });
      return res.status(200).json({ keys: keys.map(serializeApiKey) });
    }

    if (req.method === "POST") {
      const body = req.body as { name?: unknown };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 120) {
        return res.status(400).json({ error: "name is required (max 120 characters)" });
      }

      const { raw, prefix, hash } = generateApiKey();
      const key = await prisma.apiKey.create({
        data: { userId, name, keyPrefix: prefix, keyHash: hash },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      });

      return res.status(201).json({
        ...serializeApiKey(key),
        secret: raw,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[api/account/api-keys]", err);
    const message = err instanceof Error ? err.message : String(err);
    const needsMigration = message.includes("ApiKey") && message.includes("does not exist");
    return res.status(500).json({
      error: needsMigration
        ? "API keys are not set up yet. Run: cd app && npm run db:migrate:local"
        : "Failed to manage API keys",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}