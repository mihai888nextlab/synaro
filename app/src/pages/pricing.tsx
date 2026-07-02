import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import type { GetServerSideProps } from "next";

import { MinimalFooter } from "@/components/ui/minimal-footer";
import { SiteHeader } from "@/components/ui/site-header";
import { redirectIfAuthed } from "@/lib/auth-redirect";

type Plan = {
  name: string;
  price: string;
  features: { label: string; included: boolean }[];
  cta: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Hobby",
    price: "$20 / mo",
    features: [
      { label: "Sending & receiving", included: true },
      { label: "Email support", included: true },
      { label: "10,000 automation runs", included: true },
      { label: "7-day data retention", included: true },
      { label: "3 environments", included: true },
      { label: "5 AI credits / mo", included: true },
      { label: "No SLA", included: false },
      { label: "Dedicated IPs", included: false },
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "$100 / mo",
    features: [
      { label: "Sending & receiving", included: true },
      { label: "Priority support", included: true },
      { label: "100,000 automation runs", included: true },
      { label: "30-day data retention", included: true },
      { label: "20 environments", included: true },
      { label: "100 AI credits / mo", included: true },
      { label: "No daily limit", included: true },
      { label: "Dedicated IP with add-on", included: false },
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: [
      { label: "Sending & receiving", included: true },
      { label: "Priority support", included: true },
      { label: "Flexible automation runs", included: true },
      { label: "Flexible data retention", included: true },
      { label: "Flexible environments", included: true },
      { label: "Flexible AI credits", included: true },
      { label: "No daily limit", included: true },
      { label: "Dedicated IPs with add-on", included: true },
    ],
    cta: "Contact us",
  },
];

export default function PricingPage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10">
        <SiteHeader />

        <section className="mx-auto max-w-7xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-400">
              Pricing
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Flexible pricing for every stage.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Start small, scale confidently, and choose the plan that fits your
              infrastructure growth.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl overflow-hidden px-4 pb-16 sm:px-6 sm:pb-20 lg:pb-24">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`flex h-full flex-col rounded-2xl border p-6 sm:p-8 ${
                  plan.highlighted
                    ? "border-white/30 bg-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                    : "border-white/10 bg-zinc-950/90"
                }`}
              >
                <p className="text-center text-sm text-zinc-300">{plan.name}</p>
                <h2 className="mt-8 text-center text-4xl font-semibold tracking-tight">{plan.price}</h2>

                <div className="my-7 h-px bg-white/10" />

                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2 text-sm text-zinc-300">
                      {feature.included ? (
                        <CheckCircle2 className="mt-0.5 size-4 text-emerald-400" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 text-zinc-500" />
                      )}
                      {feature.label}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === "Enterprise" ? "/contact" : "/signup"}
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "border border-white/20 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white hover:bg-zinc-900"
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="rounded-2xl border border-white/15 bg-zinc-950 p-6 text-center sm:p-8">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Free Trial</p>
            <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Start with a 14-day free trial
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Explore every core feature with no credit card required. Upgrade any
              time to keep your environments and automation history.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Start free trial
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Talk to sales
              </Link>
            </div>
          </div>
        </section>

        <MinimalFooter />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard");
