import Stripe from "stripe";
import type { PlanTier } from "@prisma/client";

let client: Stripe | null = null;

/** Lazily-constructed singleton Stripe client. Throws if the secret key is missing. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key, { typescript: true });
  return client;
}

/** Whether Stripe is configured (routes can 503 cleanly otherwise). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Tiers that are self-serve purchasable via Checkout. ENTERPRISE is contact-sales. */
export const SELF_SERVE_TIERS = ["STARTER", "PRO"] as const;
export type SelfServeTier = (typeof SELF_SERVE_TIERS)[number];

export function isSelfServeTier(tier: string): tier is SelfServeTier {
  return (SELF_SERVE_TIERS as readonly string[]).includes(tier);
}

/** Stripe price id for a self-serve tier, from env. */
export function priceIdForTier(tier: SelfServeTier): string {
  const id =
    tier === "STARTER"
      ? process.env.STRIPE_PRICE_STARTER?.trim()
      : process.env.STRIPE_PRICE_PRO?.trim();
  if (!id) throw new Error(`Missing Stripe price env for tier ${tier}`);
  return id;
}

/** Reverse map: Stripe price id -> PlanTier (defaults to null if unknown). */
export function tierForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER?.trim()) return "STARTER";
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return "PRO";
  return null;
}

/** Base URL for Checkout/Portal redirects. */
export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
