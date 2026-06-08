"use client";

import * as React from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CampaignChartInterval = "daily" | "weekly" | "monthly";

const INTERVAL_META: Record<
  CampaignChartInterval,
  {
    points: number;
    base: number;
    variance: number;
    badge: string;
    /** Padding passed to Recharts domain strings, e.g. 200 → `dataMin - 200` */
    yPad: number;
    tooltip: string;
  }
> = {
  daily: {
    points: 28,
    base: 1500,
    variance: 400,
    badge: "Last 28 days",
    yPad: 200,
    tooltip:
      "Daily ad spend for the last 28 days. Hover points for amounts. Toggle Daily / Weekly / Monthly to change the series.",
  },
  weekly: {
    points: 12,
    base: 9800,
    variance: 2400,
    badge: "Last 12 weeks",
    yPad: 1400,
    tooltip:
      "Weekly ad spend totals for the last 12 weeks. Hover points for amounts. Data is placeholder until your API is connected.",
  },
  monthly: {
    points: 12,
    base: 42000,
    variance: 11000,
    badge: "Last 12 months",
    yPad: 8000,
    tooltip:
      "Monthly ad spend for the last 12 months. Hover points for amounts. Data is placeholder until your API is connected.",
  },
};

function axisLabel(interval: CampaignChartInterval, index: number): string {
  if (interval === "daily") return `Day ${index + 1}`;
  if (interval === "weekly") return `Week ${index + 1}`;
  return `Month ${index + 1}`;
}

function placeholderData(interval: CampaignChartInterval) {
  const c = INTERVAL_META[interval];
  return Array.from({ length: c.points }, (_, i) => ({
    day: axisLabel(interval, i),
    spend: c.base,
  }));
}

function generateData(interval: CampaignChartInterval) {
  const c = INTERVAL_META[interval];
  return Array.from({ length: c.points }, (_, i) => ({
    day: axisLabel(interval, i),
    spend: c.base + (Math.random() - 0.5) * 2 * c.variance,
  }));
}

const chartConfig: ChartConfig = {
  spend: {
    label: "Ad Spend",
    color: "var(--color-cyan-600)",
  },
};

const INTERVAL_ORDER: CampaignChartInterval[] = ["daily", "weekly", "monthly"];

const INTERVAL_LABEL: Record<CampaignChartInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/**
 * Campaign area chart card — placeholder series; intervals switch Daily / Weekly / Monthly.
 */
export function Component() {
  const [interval, setInterval] = React.useState<CampaignChartInterval>("daily");
  const [campaignData, setCampaignData] = React.useState(() => placeholderData("daily"));

  React.useEffect(() => {
    queueMicrotask(() => {
      setCampaignData(generateData(interval));
    });
  }, [interval]);

  const meta = INTERVAL_META[interval];
  const avgSpend =
    campaignData.length > 0
      ? campaignData.reduce((s, row) => s + row.spend, 0) / campaignData.length
      : 0;

  const yDomainTuple: [string, string] = [`dataMin - ${meta.yPad}`, `dataMax + ${meta.yPad}`];

  return (
    <Card
      className={cn(
        "flex w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0",
        "shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25",
      )}
    >
      <CardHeader className="flex flex-col gap-3 px-6 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pt-6">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="text-base font-medium text-muted-foreground">Campaign Data</CardTitle>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex rounded-md text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                  aria-label="About campaign data"
                >
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5 shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10 16.25a6.25 6.25 0 100-12.5 6.25 6.25 0 000 12.5zm1.116-3.041l.1-.408a1.709 1.709 0 01-.25.083 1.176 1.176 0 01-.308.048c-.193 0-.329-.032-.407-.095-.079-.064-.118-.184-.118-.359a3.514 3.514 0 01.118-.672l.373-1.318c.037-.121.062-.255.075-.4a3.73 3.73 0 00.02-.304.866.866 0 00-.292-.678c-.195-.174-.473-.26-.833-.26-.2 0-.412.035-.636.106-.224.07-.459.156-.704.256l-.1.409c.073-.028.16-.057.262-.087.101-.03.2-.045.297-.045.198 0 .331.034.4.1.07.066.105.185.105.354 0 .093-.01.197-.034.31a6.216 6.216 0 01-.084.36l-.374 1.325c-.033.14-.058.264-.073.374-.015.11-.022.22-.022.325 0 .272.1.496.301.673.201.177.483.265.846.265.236 0 .443-.03.621-.092s.417-.152.717-.27zM11.05 7.85a.772.772 0 00.26-.587.78.78 0 00-.26-.59.885.885 0 00-.628-.244.893.893 0 00-.63.244.778.778 0 00-.264.59c0 .23.088.426.263.587a.897.897 0 00.63.243.888.888 0 00.629-.243z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent showArrow className="max-w-[280px] text-balance">
                <p className="text-xs">{meta.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          role="tablist"
          aria-label="Chart scale"
          className="inline-flex w-full shrink-0 rounded-xl border border-border/70 bg-muted/30 p-0.5 sm:w-auto dark:bg-muted/20"
        >
          {INTERVAL_ORDER.map((key) => {
            const selected = interval === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setInterval(key)}
                className={cn(
                  "min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:flex-initial sm:px-3.5",
                  selected
                    ? "bg-card text-foreground shadow-sm dark:bg-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {INTERVAL_LABEL[key]}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 p-0 sm:gap-6">
        <div className="flex flex-wrap items-center gap-3 px-6 sm:px-8">
          <span className="text-3xl font-medium tracking-tight tabular-nums text-foreground sm:text-4xl">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(avgSpend)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Avg / {INTERVAL_LABEL[interval]}
          </span>
          <Badge className="rounded-full border-transparent bg-green-100 text-xs text-green-800 dark:bg-green-950 dark:text-green-600">
            {meta.badge}
          </Badge>
        </div>

        <div className="grid min-h-[168px] grid-cols-1 border-t border-border sm:h-[220px] sm:grid-cols-[1fr_11rem]">
          <ChartContainer config={chartConfig} className="aspect-auto min-h-[140px] w-full sm:h-full">
            <AreaChart accessibilityLayer data={campaignData} margin={{ right: 8, left: 0 }}>
              <XAxis hide />
              <YAxis hide domain={yDomainTuple} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(value as number)
                    }
                  />
                }
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Area
                type="linear"
                name="Ad Spend"
                dataKey="spend"
                stroke={chartConfig.spend.color}
                fill={chartConfig.spend.color}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: chartConfig.spend.color,
                  stroke: "var(--border)",
                  strokeWidth: 1,
                }}
              />
            </AreaChart>
          </ChartContainer>
          <div className="flex flex-col justify-end border-t border-border px-5 py-5 sm:border-t-0 sm:border-l sm:border-border">
            <div className="text-sm font-semibold tracking-tight text-foreground">45%</div>
            <div className="text-xs font-medium tracking-tight text-muted-foreground">$32.9K used</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
