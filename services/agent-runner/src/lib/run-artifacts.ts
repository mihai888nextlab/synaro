/**
 * Structured dashboard artifacts agents emit via finish({ answer, artifacts }).
 * Keep in sync with app/src/lib/agents/run-artifacts.ts
 */

export const RUN_ARTIFACT_TYPES = [
  "timeseries_chart",
  "kpi_row",
  "markdown",
  "data_table",
  "news_list",
  "ranking",
  "timeline",
  "comparison",
  "funnel",
] as const;
export type RunArtifactType = (typeof RUN_ARTIFACT_TYPES)[number];

export type ArtifactEmphasis = "hero" | "supporting";

type ArtifactBase = {
  id: string;
  title?: string;
  emphasis?: ArtifactEmphasis;
};

export type TimeseriesPoint = { t: string; v: number };
export type TimeseriesSeries = { name: string; points: TimeseriesPoint[] };

export type TimeseriesChartArtifact = ArtifactBase & {
  type: "timeseries_chart";
  title: string;
  description?: string;
  series: TimeseriesSeries[];
};

export type KpiArtifactItem = {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
};

export type KpiRowArtifact = ArtifactBase & {
  type: "kpi_row";
  items: KpiArtifactItem[];
};

export type MarkdownArtifact = ArtifactBase & {
  type: "markdown";
  body: string;
};

export type DataTableArtifact = ArtifactBase & {
  type: "data_table";
  columns: string[];
  rows: string[][];
};

export type NewsListItem = {
  title: string;
  source?: string;
  publishedAt?: string;
  url?: string;
  sentiment?: "positive" | "negative" | "neutral";
};

export type NewsListArtifact = ArtifactBase & {
  type: "news_list";
  items: NewsListItem[];
};

export type RankingItem = {
  label: string;
  value?: string;
  hint?: string;
  rank?: number;
};

export type RankingArtifact = ArtifactBase & {
  type: "ranking";
  items: RankingItem[];
};

export type TimelineItem = {
  t: string;
  title: string;
  description?: string;
  status?: "done" | "current" | "upcoming";
};

export type TimelineArtifact = ArtifactBase & {
  type: "timeline";
  items: TimelineItem[];
};

export type ComparisonMetric = { label: string; value: string };

export type ComparisonOption = {
  label: string;
  subtitle?: string;
  metrics: ComparisonMetric[];
};

export type ComparisonArtifact = ArtifactBase & {
  type: "comparison";
  options: ComparisonOption[];
};

export type FunnelStage = {
  label: string;
  value: number;
  hint?: string;
};

export type FunnelArtifact = ArtifactBase & {
  type: "funnel";
  stages: FunnelStage[];
};

export type RunArtifact =
  | TimeseriesChartArtifact
  | KpiRowArtifact
  | MarkdownArtifact
  | DataTableArtifact
  | NewsListArtifact
  | RankingArtifact
  | TimelineArtifact
  | ComparisonArtifact
  | FunnelArtifact;

const MAX_ARTIFACTS = 12;
const MAX_SERIES = 4;
const MAX_POINTS = 120;
const MAX_KPI_ITEMS = 8;
const MAX_TABLE_COLS = 8;
const MAX_TABLE_ROWS = 20;
const MAX_NEWS_ITEMS = 10;
const MAX_RANKING_ITEMS = 12;
const MAX_TIMELINE_ITEMS = 12;
const MAX_COMPARISON_OPTIONS = 4;
const MAX_COMPARISON_METRICS = 6;
const MAX_FUNNEL_STAGES = 8;
const MAX_STRING = 200;
const MAX_MARKDOWN = 4_000;
const MAX_CELL = 120;
const MAX_URL = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clipString(value: unknown, max = MAX_STRING): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function parseEmphasis(raw: unknown): ArtifactEmphasis | undefined {
  const value = clipString(raw, 16);
  return value === "hero" || value === "supporting" ? value : undefined;
}

function parsePoints(raw: unknown): TimeseriesPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: TimeseriesPoint[] = [];
  for (const item of raw.slice(0, MAX_POINTS)) {
    const row = asRecord(item);
    if (!row) continue;
    const t = clipString(row.t ?? row.x ?? row.label, 64);
    const vRaw = row.v ?? row.y ?? row.value;
    const v = typeof vRaw === "number" ? vRaw : Number(vRaw);
    if (!t || !Number.isFinite(v)) continue;
    points.push({ t, v });
  }
  return points;
}

function parseSeries(raw: unknown): TimeseriesSeries[] {
  if (!Array.isArray(raw)) return [];
  const series: TimeseriesSeries[] = [];
  for (const item of raw.slice(0, MAX_SERIES)) {
    const row = asRecord(item);
    if (!row) continue;
    const name = clipString(row.name ?? row.label, 80) ?? "Series";
    const points = parsePoints(row.points ?? row.data);
    if (points.length === 0) continue;
    series.push({ name, points });
  }
  return series;
}

function parseKpiItems(raw: unknown): KpiArtifactItem[] {
  if (!Array.isArray(raw)) return [];
  const items: KpiArtifactItem[] = [];
  for (const item of raw.slice(0, MAX_KPI_ITEMS)) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clipString(row.label ?? row.name, 80);
    const value = clipString(row.value, 80);
    if (!label || !value) continue;
    const trendRaw = clipString(row.trend, 8);
    const trend =
      trendRaw === "up" || trendRaw === "down" || trendRaw === "flat" ? trendRaw : undefined;
    const hint = clipString(row.hint ?? row.subtitle, 120) ?? undefined;
    items.push({ label, value, hint, trend });
  }
  return items;
}

function parseTableColumns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cols: string[] = [];
  for (const item of raw.slice(0, MAX_TABLE_COLS)) {
    const col = clipString(item, 80);
    if (col) cols.push(col);
  }
  return cols;
}

function parseTableRows(raw: unknown, colCount: number): string[][] {
  if (!Array.isArray(raw) || colCount === 0) return [];
  const rows: string[][] = [];
  for (const item of raw.slice(0, MAX_TABLE_ROWS)) {
    if (!Array.isArray(item)) continue;
    const cells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const cell = clipString(item[c], MAX_CELL);
      cells.push(cell ?? "");
    }
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

function parseNewsItems(raw: unknown): NewsListItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NewsListItem[] = [];
  for (const item of raw.slice(0, MAX_NEWS_ITEMS)) {
    const row = asRecord(item);
    if (!row) continue;
    const title = clipString(row.title ?? row.headline, 200);
    if (!title) continue;
    const sentimentRaw = clipString(row.sentiment, 16);
    const sentiment =
      sentimentRaw === "positive" || sentimentRaw === "negative" || sentimentRaw === "neutral"
        ? sentimentRaw
        : undefined;
    const url = clipString(row.url ?? row.link, MAX_URL) ?? undefined;
    items.push({
      title,
      source: clipString(row.source ?? row.publisher, 80) ?? undefined,
      publishedAt: clipString(row.publishedAt ?? row.time ?? row.date, 64) ?? undefined,
      url: url && /^https?:\/\//i.test(url) ? url : undefined,
      sentiment,
    });
  }
  return items;
}

function parseRankingItems(raw: unknown): RankingItem[] {
  if (!Array.isArray(raw)) return [];
  const items: RankingItem[] = [];
  for (let i = 0; i < raw.length && items.length < MAX_RANKING_ITEMS; i++) {
    const row = asRecord(raw[i]);
    if (!row) continue;
    const label = clipString(row.label ?? row.name ?? row.title, 120);
    if (!label) continue;
    const rankRaw = row.rank ?? row.position;
    const rank =
      typeof rankRaw === "number" && Number.isFinite(rankRaw)
        ? Math.max(1, Math.round(rankRaw))
        : i + 1;
    items.push({
      label,
      value: clipString(row.value ?? row.score, 80) ?? undefined,
      hint: clipString(row.hint ?? row.subtitle, 120) ?? undefined,
      rank,
    });
  }
  return items;
}

function parseTimelineItems(raw: unknown): TimelineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: TimelineItem[] = [];
  for (const item of raw.slice(0, MAX_TIMELINE_ITEMS)) {
    const row = asRecord(item);
    if (!row) continue;
    const t = clipString(row.t ?? row.time ?? row.when ?? row.date, 64);
    const title = clipString(row.title ?? row.label ?? row.name, 120);
    if (!t || !title) continue;
    const statusRaw = clipString(row.status, 16);
    const status =
      statusRaw === "done" || statusRaw === "current" || statusRaw === "upcoming"
        ? statusRaw
        : undefined;
    items.push({
      t,
      title,
      description: clipString(row.description ?? row.detail ?? row.body, 240) ?? undefined,
      status,
    });
  }
  return items;
}

function parseComparisonOptions(raw: unknown): ComparisonOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ComparisonOption[] = [];
  for (const item of raw.slice(0, MAX_COMPARISON_OPTIONS)) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clipString(row.label ?? row.name ?? row.title, 80);
    if (!label) continue;
    const metricsRaw = row.metrics ?? row.stats ?? row.values;
    const metrics: ComparisonMetric[] = [];
    if (Array.isArray(metricsRaw)) {
      for (const m of metricsRaw.slice(0, MAX_COMPARISON_METRICS)) {
        const mr = asRecord(m);
        if (!mr) continue;
        const mLabel = clipString(mr.label ?? mr.name, 80);
        const mValue = clipString(mr.value, 80);
        if (!mLabel || !mValue) continue;
        metrics.push({ label: mLabel, value: mValue });
      }
    }
    if (metrics.length === 0) continue;
    options.push({
      label,
      subtitle: clipString(row.subtitle ?? row.hint, 120) ?? undefined,
      metrics,
    });
  }
  return options;
}

function parseFunnelStages(raw: unknown): FunnelStage[] {
  if (!Array.isArray(raw)) return [];
  const stages: FunnelStage[] = [];
  for (const item of raw.slice(0, MAX_FUNNEL_STAGES)) {
    const row = asRecord(item);
    if (!row) continue;
    const label = clipString(row.label ?? row.name ?? row.stage, 80);
    const vRaw = row.value ?? row.count ?? row.v;
    const value = typeof vRaw === "number" ? vRaw : Number(vRaw);
    if (!label || !Number.isFinite(value) || value < 0) continue;
    stages.push({
      label,
      value,
      hint: clipString(row.hint ?? row.subtitle, 120) ?? undefined,
    });
  }
  return stages;
}

function parseOne(raw: unknown, index: number): RunArtifact | null {
  const row = asRecord(raw);
  if (!row) return null;
  const type = clipString(row.type, 40);
  const id = clipString(row.id, 64) ?? `artifact-${index + 1}`;
  const emphasis = parseEmphasis(row.emphasis);
  const title = clipString(row.title, 120) ?? undefined;

  if (type === "timeseries_chart") {
    const chartTitle = clipString(row.title, 120);
    const series = parseSeries(row.series);
    if (!chartTitle || series.length === 0) return null;
    return {
      id,
      type: "timeseries_chart",
      title: chartTitle,
      description: clipString(row.description, 240) ?? undefined,
      series,
      emphasis,
    };
  }

  if (type === "kpi_row") {
    const items = parseKpiItems(row.items ?? row.kpis);
    if (items.length === 0) return null;
    return { id, type: "kpi_row", title, items, emphasis };
  }

  if (type === "markdown") {
    const body = clipString(row.body ?? row.content ?? row.markdown, MAX_MARKDOWN);
    if (!body) return null;
    return { id, type: "markdown", title, body, emphasis };
  }

  if (type === "data_table") {
    const columns = parseTableColumns(row.columns ?? row.headers);
    const rows = parseTableRows(row.rows ?? row.data, columns.length);
    if (columns.length === 0 || rows.length === 0) return null;
    return { id, type: "data_table", title, columns, rows, emphasis };
  }

  if (type === "news_list") {
    const items = parseNewsItems(row.items ?? row.articles ?? row.headlines);
    if (items.length === 0) return null;
    return { id, type: "news_list", title, items, emphasis };
  }

  if (type === "ranking") {
    const items = parseRankingItems(row.items ?? row.ranks ?? row.entries);
    if (items.length === 0) return null;
    return { id, type: "ranking", title, items, emphasis };
  }

  if (type === "timeline") {
    const items = parseTimelineItems(row.items ?? row.events ?? row.steps);
    if (items.length === 0) return null;
    return { id, type: "timeline", title, items, emphasis };
  }

  if (type === "comparison") {
    const options = parseComparisonOptions(row.options ?? row.items ?? row.sides);
    if (options.length < 2) return null;
    return { id, type: "comparison", title, options, emphasis };
  }

  if (type === "funnel") {
    const stages = parseFunnelStages(row.stages ?? row.steps ?? row.items);
    if (stages.length < 2) return null;
    return { id, type: "funnel", title, stages, emphasis };
  }

  return null;
}

export function normalizeRunArtifacts(raw: unknown): RunArtifact[] {
  if (!Array.isArray(raw)) return [];
  const out: RunArtifact[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length && out.length < MAX_ARTIFACTS; i++) {
    const artifact = parseOne(raw[i], i);
    if (!artifact) continue;
    let id = artifact.id;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    out.push({ ...artifact, id });
  }
  return out;
}
