"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { MarkdownLite } from "@/components/ui/markdown-lite";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  normalizeRunArtifacts,
  type ComparisonArtifact,
  type DataTableArtifact,
  type FunnelArtifact,
  type KpiRowArtifact,
  type MarkdownArtifact,
  type NewsListArtifact,
  type RankingArtifact,
  type RunArtifact,
  type TimelineArtifact,
  type TimeseriesChartArtifact,
} from "@/lib/agents/run-artifacts";
import { cn } from "@/lib/utils";

/** Hex / CSS vars — theme tokens are hex (`#fff`), so `hsl(var(--primary))` is invalid. */
const CHART_COLORS = [
  "var(--color-cyan-600)",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
];

function seriesKey(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || `series_${index}`;
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUpRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (trend === "down") return <ArrowDownRight className="size-3.5 text-red-600 dark:text-red-400" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

function SectionTitle({ title, hero }: { title?: string; hero?: boolean }) {
  if (!title) return null;
  return (
    <p className={cn("font-semibold text-foreground", hero ? "text-base" : "text-sm")}>{title}</p>
  );
}

function KpiRowView({ artifact, hero }: { artifact: KpiRowArtifact; hero?: boolean }) {
  const singleHero = hero && artifact.items.length === 1;
  const item = artifact.items[0];

  if (singleHero && item) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {artifact.title ?? item.label}
        </p>
        <div className="flex items-end gap-3">
          <p className="text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
            {item.value}
          </p>
          <TrendIcon trend={item.trend} />
        </div>
        {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artifact.title ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{artifact.title}</p>
      ) : null}
      <div className={cn("grid gap-2", hero ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
        {artifact.items.map((kpi) => (
          <div
            key={`${artifact.id}-${kpi.label}`}
            className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[0.7rem] text-muted-foreground">{kpi.label}</p>
              <TrendIcon trend={kpi.trend} />
            </div>
            <p
              className={cn(
                "mt-1 truncate font-semibold tracking-tight text-foreground",
                hero ? "text-lg" : "text-base",
              )}
            >
              {kpi.value}
            </p>
            {kpi.hint ? <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground">{kpi.hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeseriesChartView({
  artifact,
  hero,
}: {
  artifact: TimeseriesChartArtifact;
  hero?: boolean;
}) {
  const primary = artifact.series[0];
  if (!primary) return null;

  const keyedSeries = artifact.series.map((series, index) => ({
    ...series,
    key: seriesKey(series.name, index),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const labels = primary.points.map((p) => p.t);
  const data = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const series of keyedSeries) {
      const point = series.points[index] ?? series.points.find((p) => p.t === label);
      row[series.key] = point?.v ?? 0;
    }
    return row;
  });

  const values = keyedSeries.flatMap((series) => series.points.map((p) => p.v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
  const yDomain: [number, number] = [min - pad, max + pad];

  const config = Object.fromEntries(
    keyedSeries.map((series) => [series.key, { label: series.name, color: series.color }]),
  ) as ChartConfig;

  return (
    <div className="space-y-2">
      <div>
        <SectionTitle title={artifact.title} hero={hero} />
        {artifact.description ? (
          <p className="text-xs text-muted-foreground">{artifact.description}</p>
        ) : null}
      </div>
      <ChartContainer
        config={config}
        className={cn("aspect-[16/9] w-full", hero ? "min-h-[12rem]" : "min-h-[9rem]")}
      >
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            tickMargin={4}
            domain={yDomain}
            allowDataOverflow
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {keyedSeries.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: series.color, stroke: "var(--border)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function MarkdownView({ artifact, hero }: { artifact: MarkdownArtifact; hero?: boolean }) {
  return (
    <div className="space-y-1.5">
      <SectionTitle title={artifact.title} hero={hero} />
      <div className={cn("text-muted-foreground", hero ? "text-base" : "text-sm")}>
        <MarkdownLite text={artifact.body} />
      </div>
    </div>
  );
}

function DataTableView({ artifact, hero }: { artifact: DataTableArtifact; hero?: boolean }) {
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[16rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              {artifact.columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-2.5 py-2 font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifact.rows.map((row, rowIndex) => (
              <tr
                key={`${artifact.id}-row-${rowIndex}`}
                className="border-b border-border/40 last:border-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${artifact.id}-${rowIndex}-${cellIndex}`}
                    className="whitespace-nowrap px-2.5 py-2 tabular-nums text-foreground"
                  >
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sentimentClass(sentiment?: "positive" | "negative" | "neutral") {
  if (sentiment === "positive") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (sentiment === "negative") return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (sentiment === "neutral") return "bg-muted text-muted-foreground";
  return null;
}

function NewsListView({ artifact, hero }: { artifact: NewsListArtifact; hero?: boolean }) {
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
        {artifact.items.map((item, index) => {
          const chip = sentimentClass(item.sentiment);
          const meta = [item.source, item.publishedAt].filter(Boolean).join(" · ");
          const titleNode = item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <span className="font-medium text-foreground">{item.title}</span>
          );

          return (
            <li key={`${artifact.id}-${index}`} className="flex items-start gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm leading-snug">{titleNode}</p>
                {meta ? <p className="text-[0.7rem] text-muted-foreground">{meta}</p> : null}
              </div>
              {chip && item.sentiment ? (
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium capitalize",
                    chip,
                  )}
                >
                  {item.sentiment}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RankingView({ artifact, hero }: { artifact: RankingArtifact; hero?: boolean }) {
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <ol className="space-y-1.5">
        {artifact.items.map((item, index) => (
          <li
            key={`${artifact.id}-${item.rank ?? index}-${item.label}`}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-xs font-semibold tabular-nums text-foreground",
                hero && index === 0 && "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
              )}
            >
              {item.rank ?? index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              {item.hint ? <p className="truncate text-[0.7rem] text-muted-foreground">{item.hint}</p> : null}
            </div>
            {item.value ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{item.value}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TimelineView({ artifact, hero }: { artifact: TimelineArtifact; hero?: boolean }) {
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <ul className="relative space-y-0 border-l border-border/70 ml-2.5">
        {artifact.items.map((item, index) => {
          const active = item.status === "current";
          const done = item.status === "done";
          return (
            <li key={`${artifact.id}-${index}`} className="relative pl-5 pb-4 last:pb-0">
              <span
                className={cn(
                  "absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-background",
                  active && "bg-cyan-500",
                  done && "bg-emerald-500",
                  !active && !done && "bg-muted-foreground/50",
                )}
              />
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{item.t}</p>
              <p className={cn("text-sm font-medium text-foreground", active && "text-cyan-700 dark:text-cyan-300")}>
                {item.title}
              </p>
              {item.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ComparisonView({ artifact, hero }: { artifact: ComparisonArtifact; hero?: boolean }) {
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <div
        className={cn(
          "grid gap-2",
          artifact.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {artifact.options.map((option) => (
          <div
            key={`${artifact.id}-${option.label}`}
            className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3"
          >
            <p className="text-sm font-semibold text-foreground">{option.label}</p>
            {option.subtitle ? (
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{option.subtitle}</p>
            ) : null}
            <dl className="mt-2.5 space-y-1.5">
              {option.metrics.map((metric) => (
                <div key={`${option.label}-${metric.label}`} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[0.7rem] text-muted-foreground">{metric.label}</dt>
                  <dd className="text-sm font-medium tabular-nums text-foreground">{metric.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelView({ artifact, hero }: { artifact: FunnelArtifact; hero?: boolean }) {
  const max = Math.max(...artifact.stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      <SectionTitle title={artifact.title} hero={hero} />
      <div className="space-y-2">
        {artifact.stages.map((stage, index) => {
          const widthPct = Math.max(12, Math.round((stage.value / max) * 100));
          const prev = artifact.stages[index - 1]?.value;
          const drop =
            prev && prev > 0 ? Math.round(((prev - stage.value) / prev) * 100) : null;
          return (
            <div key={`${artifact.id}-${stage.label}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.value.toLocaleString()}
                  {stage.hint ? ` · ${stage.hint}` : ""}
                  {drop !== null ? ` · −${drop}%` : ""}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-cyan-500/80 transition-[width]"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ArtifactBlock({
  artifact,
  hero,
}: {
  artifact: RunArtifact;
  hero?: boolean;
}) {
  const isHero = hero || artifact.emphasis === "hero";
  if (artifact.type === "kpi_row") return <KpiRowView artifact={artifact} hero={isHero} />;
  if (artifact.type === "timeseries_chart") {
    return <TimeseriesChartView artifact={artifact} hero={isHero} />;
  }
  if (artifact.type === "data_table") return <DataTableView artifact={artifact} hero={isHero} />;
  if (artifact.type === "news_list") return <NewsListView artifact={artifact} hero={isHero} />;
  if (artifact.type === "ranking") return <RankingView artifact={artifact} hero={isHero} />;
  if (artifact.type === "timeline") return <TimelineView artifact={artifact} hero={isHero} />;
  if (artifact.type === "comparison") return <ComparisonView artifact={artifact} hero={isHero} />;
  if (artifact.type === "funnel") return <FunnelView artifact={artifact} hero={isHero} />;
  return <MarkdownView artifact={artifact} hero={isHero} />;
}

export function RunArtifactsPanel({
  artifacts: rawArtifacts,
  emptyLabel,
  className,
  title,
  dense = false,
}: {
  artifacts: unknown;
  emptyLabel?: string;
  className?: string;
  title?: string;
  /** Tighter spacing for dashboard widget cells. */
  dense?: boolean;
}) {
  const artifacts = normalizeRunArtifacts(rawArtifacts);

  if (artifacts.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const heroIndex = artifacts.findIndex((a) => a.emphasis === "hero");
  const leadIndex = heroIndex >= 0 ? heroIndex : 0;

  return (
    <div className={cn("flex min-h-0 flex-col", dense ? "gap-3" : "gap-4", className)}>
      {title ? <h2 className="text-sm font-medium text-foreground">{title}</h2> : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-auto pr-0.5",
          dense ? "gap-3" : "gap-5",
        )}
      >
        {artifacts.map((artifact, index) => (
          <div
            key={artifact.id}
            className={cn(index === leadIndex && artifacts.length > 1 && "pb-1")}
          >
            <ArtifactBlock artifact={artifact} hero={index === leadIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}
