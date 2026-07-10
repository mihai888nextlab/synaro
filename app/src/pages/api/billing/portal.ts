import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Billing is not configured" });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "no_customer", detail: "No billing account yet. Subscribe first." });
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appBaseUrl()}/settings/billing`,
    });

    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error("[billing/portal]", err);
    return res.status(500).json({ error: "Could not open billing portal" });
  }
}
