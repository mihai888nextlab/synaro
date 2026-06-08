import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { Component as CampaignAreaChartCard } from "@/components/ui/area-chart-analytics-card";
import { requireAuth } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

type Metric = { label: string; value: string; hint: string };

const PLACEHOLDER_METRICS: Metric[] = [
  { label: "Page views", value: "12.4k", hint: "Last 30 days" },
  { label: "Unique visitors", value: "3.1k", hint: "Last 30 days" },
  { label: "Avg. session", value: "4m 12s", hint: "Engaged sessions" },
  { label: "Bounce rate", value: "38%", hint: "Vs previous period" },
];

function MetricCell({ metric }: { metric: Metric }) {
  return (
    <article
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm shadow-black/[0.06]",
        "dark:border-border/50 dark:bg-card/90 dark:shadow-black/25 lg:px-3.5 lg:py-3",
      )}
    >
      <p className="text-[0.65rem] font-medium uppercase leading-tight tracking-[0.08em] text-muted-foreground lg:text-[0.7rem]">
        {metric.label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-foreground lg:mt-1.5 lg:text-lg lg:leading-snug xl:text-xl">
        {metric.value}
      </p>
      <p className="mt-auto pt-3 text-[0.7rem] leading-snug text-muted-foreground lg:pt-2 lg:text-[0.65rem] xl:text-xs">
        {metric.hint}
      </p>
    </article>
  );
}

export default function ProjectAnalyticsPage() {
  const router = useRouter();

  if (!router.isReady) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 sm:gap-10">
        <section
          aria-label="Project analytics"
          className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5 xl:gap-6"
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-wrap gap-4">
              <CampaignAreaChartCard />
            </div>
          </div>

          <aside
            aria-label="Key metrics"
            className={cn(
              "mx-auto flex min-h-0 w-full max-w-sm shrink-0 flex-col",
              "max-lg:max-w-none lg:mx-0 lg:max-w-none lg:w-[min(100%,22rem)] xl:w-96",
            )}
          >
            <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[auto_auto] gap-2.5 sm:gap-3 lg:grid-rows-[1fr_1fr] xl:gap-3.5">
              {PLACEHOLDER_METRICS.map((m) => (
                <MetricCell key={m.label} metric={m} />
              ))}
            </div>
          </aside>
        </section>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
