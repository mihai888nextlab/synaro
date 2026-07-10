import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import {
  appBaseUrl,
  getStripe,
  isSelfServeTier,
  isStripeConfigured,
  priceIdForTier,
} from "@/lib/billing/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Billing is not configured" });

  const tier = typeof req.body?.tier === "string" ? req.body.tier : "";
  if (!isSelfServeTier(tier)) {
    return res.status(400).json({
      error: "invalid_tier",
      detail: "Enterprise is sales-led; contact us. Choose STARTER or PRO for self-serve checkout.",
    });
  }

  const userId = session.user.id;
  const stripe = getStripe();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Ensure a Stripe customer exists and is persisted (survives cancellation).
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    const base = appBaseUrl();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceIdForTier(tier), quantity: 1 }],
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
      success_url: `${base}/settings/billing?checkout=success`,
      cancel_url: `${base}/settings/billing?checkout=cancel`,
    });

    return res.status(200).json({ url: checkout.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return res.status(500).json({ error: "Could not start checkout" });
  }
}
