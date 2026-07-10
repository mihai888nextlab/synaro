import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { CreditCard, ExternalLink, Zap } from "lucide-react";
import type { GetServerSideProps } from "next";

import { requireAuth } from "@/lib/auth-redirect";
import { readJsonResponse } from "@/lib/read-json-response";

type Meter = { used: number; limit: number };

type Summary = {
  tier: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
  trialActive: boolean;
  trialEndsAt: string | null;
  gated: boolean;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  billingConfigured: boolean;
  usage: {
    agentRuns: Meter;
    projects: Meter;
    concurrentEnvironments: Meter;
  };
};

const TIER_LABEL: Record<Summary["tier"], string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const UPGRADE_TIERS = [
  { tier: "STARTER" as const, name: "Starter", price: "$20 / mo", blurb: "For solo builders shipping steadily." },
  { tier: "PRO" as const, name: "Pro", price: "$100 / mo", blurb: "For teams running many agents and environments." },
];

function fmtLimit(n: number): string {
  return n < 0 ? "∞" : n.toLocaleString();
}

function UsageBar({ label, meter }: { label: string; meter: Meter }) {
  const unlimited = meter.limit < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((meter.used / Math.max(meter.limit, 1)) * 100));
  const near = !unlimited && pct >= 80;
  return (
    <div className="rounded-xl border border-border/70 bg-muted p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {meter.used.toLocaleString()}
          <span className="text-muted-foreground/70"> / {fmtLimit(meter.limit)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className={`h-full rounded-full transition-all ${near ? "bg-amber-500" : "bg-foreground"}`}
          style={{ width: unlimited ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/summary");
      const data = await readJsonResponse<Summary & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load billing");
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCheckout(tier: "STARTER" | "PRO") {
    if (busy) return;
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await readJsonResponse<{ url?: string; error?: string; detail?: string }>(res);
      if (!res.ok || !data.url) throw new Error(data.detail ?? data.error ?? "Could not start checkout");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(null);
    }
  }

  async function openPortal() {
    if (busy) return;
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await readJsonResponse<{ url?: string; error?: string; detail?: string }>(res);
      if (!res.ok || !data.url) throw new Error(data.detail ?? data.error ?? "Could not open billing portal");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal");
      setBusy(null);
    }
  }

  const checkoutFlag = typeof router.query.checkout === "string" ? router.query.checkout : null;
  const hasPaidSub =
    summary?.subscriptionStatus != null &&
    ["ACTIVE", "TRIALING", "PAST_DUE"].includes(summary.subscriptionStatus);

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Billing & plan</p>
            <p className="mt-1 text-sm text-muted-foreground/80">
              Manage your subscription, view usage, and upgrade.
            </p>
          </div>
          {summary ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-sm font-medium">
              <Zap className="size-4" />
              {TIER_LABEL[summary.tier]}
              {summary.trialActive ? <span className="text-muted-foreground">· Trial</span> : null}
            </span>
          ) : null}
        </div>

        {checkoutFlag === "success" ? (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            Payment received — your plan is being activated. It may take a moment to reflect below.
          </p>
        ) : null}
        {checkoutFlag === "cancel" ? (
          <p className="mt-4 rounded-xl border border-border/70 bg-muted p-3 text-sm text-muted-foreground">
            Checkout canceled. No changes were made.
          </p>
        ) : null}

        {summary?.trialActive && summary.trialEndsAt ? (
          <p className="mt-4 rounded-xl border border-border/70 bg-muted p-3 text-sm text-muted-foreground">
            Free trial active until {new Date(summary.trialEndsAt).toLocaleDateString()}.
          </p>
        ) : null}
        {summary?.gated ? (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Your free trial has ended. Upgrade to keep creating projects and running agents.
          </p>
        ) : null}
        {summary?.cancelAtPeriodEnd && summary.currentPeriodEnd ? (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Your plan is set to cancel on {new Date(summary.currentPeriodEnd).toLocaleDateString()}.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        {summary && !summary.billingConfigured ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Billing is not fully configured on this environment yet.
          </p>
        ) : null}

        {hasPaidSub ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={busy !== null}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <CreditCard className="size-4" />
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
        ) : null}
      </div>

      {/* Usage */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Usage this month</p>
        {loading || !summary ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <UsageBar label="Agent runs" meter={summary.usage.agentRuns} />
            <UsageBar label="Projects" meter={summary.usage.projects} />
            <UsageBar label="Running environments" meter={summary.usage.concurrentEnvironments} />
          </div>
        )}
      </div>

      {/* Upgrade */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Plans</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {UPGRADE_TIERS.map((plan) => {
            const isCurrent = summary?.tier === plan.tier;
            return (
              <div key={plan.tier} className="flex flex-col rounded-xl border border-border/70 bg-muted p-4">
                <p className="font-medium">{plan.name}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{plan.price}</p>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{plan.blurb}</p>
                <button
                  type="button"
                  onClick={() => void startCheckout(plan.tier)}
                  disabled={busy !== null || isCurrent}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition enabled:hover:opacity-90 disabled:opacity-50"
                >
                  {isCurrent ? "Current plan" : busy === plan.tier ? "Redirecting…" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
          <div className="flex flex-col rounded-xl border border-border/70 bg-muted p-4">
            <p className="font-medium">Enterprise</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">Custom</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Dedicated compute, higher limits, and support.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Contact sales
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
