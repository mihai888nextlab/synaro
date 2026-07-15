import type { NextApiRequest, NextApiResponse } from "next";

import { sendPasswordResetEmail } from "@/lib/auth/send-reset-email";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const email =
    typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, name: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const sent = await sendPasswordResetEmail(user.email, user.name);
    if (!sent.ok && sent.reason === "rate_limited") {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
  }

  return res.status(200).json({
    message: "If an account exists, a reset link was sent.",
    devLink:
      process.env.NODE_ENV === "development" && user?.passwordHash
        ? undefined
        : undefined,
  });
}
