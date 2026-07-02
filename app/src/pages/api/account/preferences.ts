import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { isLocale, type Locale } from "@/i18n/config";
import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";

type PreferencesResponse =
  | { preferredLocale: Locale }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PreferencesResponse>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLocale: true },
    });
    const preferredLocale = isLocale(user?.preferredLocale) ? user.preferredLocale : "en";
    return res.status(200).json({ preferredLocale });
  }

  if (req.method === "PATCH") {
    const raw = req.body?.preferredLocale;
    if (typeof raw !== "string" || !isLocale(raw)) {
      return res.status(400).json({ error: "Invalid locale." });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { preferredLocale: raw },
      select: { preferredLocale: true },
    });

    return res.status(200).json({
      preferredLocale: isLocale(user.preferredLocale) ? user.preferredLocale : "en",
    });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
