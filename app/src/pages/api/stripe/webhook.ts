import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured, tierForPriceId } from "@/lib/billing/stripe";
import { invalidateEntitlements } from "@/lib/billing/get-user-entitlements";

// Stripe signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  unpaid: "UNPAID",
  paused: "PAUSED",
};

function customerId(v: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

/** current_period_end lives on the subscription (older APIs) or its first item (newer). */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const secs =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    item?.current_period_end;
  return typeof secs === "number" ? new Date(secs * 1000) : null;
}

/** Resolve our userId from a subscription (metadata first, then customer lookup). */
async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.userId;
  if (fromMeta) return fromMeta;
  const cust = customerId(sub.customer);
  if (!cust) return null;
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: cust },
    select: { id: true },
  });
  return user?.id ?? null;
}

/** Upsert our Subscription mirror from a Stripe subscription object (idempotent by stripeSubscriptionId). */
async function syncSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const userId = await resolveUserId(sub);
  if (!userId) {
    console.warn("[stripe/webhook] could not resolve userId for subscription", sub.id);
    return null;
  }

  const priceId = sub.items?.data?.[0]?.price?.id ?? "";
  const tier = tierForPriceId(priceId);
  const status = STATUS_MAP[sub.status] ?? "INCOMPLETE";

  // Persist the customer id if we don't have it yet.
  const cust = customerId(sub.customer);
  if (cust) {
    await prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { stripeCustomerId: cust },
    });
  }

  // Unknown price (e.g. a manually-created Enterprise price) => keep any existing tier.
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { tier: true },
  });
  const resolvedTier = tier ?? existing?.tier ?? "STARTER";

  const data = {
    tier: resolvedTier,
    status,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  invalidateEntitlements(userId);
  return userId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Billing is not configured" });
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      raw,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return res.status(400).json({ error: "invalid_signature" });
  }

  // Idempotency: record the event id first; a duplicate delivery is a no-op.
  try {
    await prisma.processedStripeEvent.create({ data: { id: event.id } });
  } catch {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // client_reference_id is the most reliable userId at checkout time.
          if (s.client_reference_id && !sub.metadata?.userId) {
            sub.metadata = { ...sub.metadata, userId: s.client_reference_id };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subRef = (inv as unknown as { subscription?: string | Stripe.Subscription }).subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged without action.
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] handler error for ${event.type}:`, err);
    // Let Stripe retry: remove the idempotency record so the retry re-processes.
    await prisma.processedStripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    return res.status(500).json({ error: "handler_error" });
  }

  return res.status(200).json({ received: true });
}
