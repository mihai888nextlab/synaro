import { Cloud, Lock, Rocket, Shield, Users, Zap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const featureItems = [
  {
    title: "Secure by default",
    description:
      "Policy-as-code guardrails, encrypted secrets, and private networking shipped out of the box.",
    icon: Shield,
  },
  {
    title: "Faster than legacy platforms",
    description:
      "Provision complete environments in minutes with reusable blueprints and one-click previews.",
    icon: Rocket,
  },
  {
    title: "Built for B2B teams",
    description:
      "Granular roles, audit logs, and multi-workspace controls designed for modern organizations.",
    icon: Users,
  },
  {
    title: "Reliable runtime",
    description:
      "Health checks, failover controls, and realtime status monitoring for production confidence.",
    icon: Cloud,
  },
  {
    title: "Instant performance",
    description:
      "Global edge delivery and automatic optimization so every deployment stays lightning fast.",
    icon: Zap,
  },
  {
    title: "Enterprise controls",
    description:
      "SOC-ready access policies, approval gates, and compliance-ready change history on every deploy.",
    icon: Lock,
  },
];

export function Features() {
  return (
    <section className="bg-black py-16 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Features</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
            Infrastructure tooling your team actually loves to use.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureItems.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-white/10 bg-white/[0.03] text-white shadow-none">
              <CardContent className="flex flex-col gap-4 p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/20">
                  <Icon className="size-5 text-white" strokeWidth={1.5} />
                </span>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
