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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CARD =
  "margin:16px 0 0;padding:14px 16px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;";
const TITLE =
  "margin:0 0 10px;font-size:13px;font-weight:600;color:#ffffff;letter-spacing:-0.01em;";
const MUTED = "font-size:12px;line-height:1.5;color:#71717a;";

function sectionTitle(title: string | undefined, fallback: string): string {
  return escapeHtml(title?.trim() || fallback);
}

function renderKpi(artifact: KpiRowArtifact): { html: string; text: string } {
  const cells = artifact.items
    .map((item) => {
      const trend =
        item.trend === "up" ? " ↑" : item.trend === "down" ? " ↓" : item.trend === "flat" ? " →" : "";
      const hint = item.hint
        ? `<div style="${MUTED};margin-top:4px;">${escapeHtml(item.hint)}</div>`
        : "";
      return `<td style="padding:8px 10px 8px 0;vertical-align:top;min-width:72px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">${escapeHtml(item.label)}</div>
        <div style="margin-top:4px;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(item.value)}${trend}</div>
        ${hint}
      </td>`;
    })
    .join("");

  const textLines = artifact.items.map((item) => {
    const trend = item.trend ? ` (${item.trend})` : "";
    const hint = item.hint ? ` — ${item.hint}` : "";
    return `  ${item.label}: ${item.value}${trend}${hint}`;
  });

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "KPIs")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr>${cells}</tr></table></div>`,
    text: [`${artifact.title ?? "KPIs"}`, ...textLines].join("\n"),
  };
}

function renderTable(artifact: DataTableArtifact): { html: string; text: string } {
  const head = artifact.columns
    .map(
      (col) =>
        `<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#a1a1aa;border-bottom:1px solid rgba(255,255,255,0.1);">${escapeHtml(col)}</th>`,
    )
    .join("");
  const body = artifact.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:8px 10px;font-size:12px;color:#e4e4e7;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const textRows = [
    artifact.columns.join(" | "),
    ...artifact.rows.map((row) => row.join(" | ")),
  ];

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Table")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
    text: [`${artifact.title ?? "Table"}`, ...textRows].join("\n"),
  };
}

function renderRanking(artifact: RankingArtifact): { html: string; text: string } {
  const rows = artifact.items
    .map((item, index) => {
      const rank = item.rank ?? index + 1;
      const value = item.value
        ? `<td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#ffffff;white-space:nowrap;">${escapeHtml(item.value)}</td>`
        : "";
      const hint = item.hint
        ? `<div style="${MUTED};margin-top:2px;">${escapeHtml(item.hint)}</div>`
        : "";
      return `<tr>
        <td style="padding:8px 10px 8px 0;width:28px;font-size:12px;color:#71717a;vertical-align:top;">${rank}</td>
        <td style="padding:8px 10px 8px 0;font-size:13px;color:#e4e4e7;vertical-align:top;">${escapeHtml(item.label)}${hint}</td>
        ${value}
      </tr>`;
    })
    .join("");

  const textLines = artifact.items.map((item, index) => {
    const rank = item.rank ?? index + 1;
    const value = item.value ? ` — ${item.value}` : "";
    return `  ${rank}. ${item.label}${value}`;
  });

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Ranking")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table></div>`,
    text: [`${artifact.title ?? "Ranking"}`, ...textLines].join("\n"),
  };
}

function renderTimeline(artifact: TimelineArtifact): { html: string; text: string } {
  const rows = artifact.items
    .map((item) => {
      const status =
        item.status === "done"
          ? "Done"
          : item.status === "current"
            ? "Current"
            : item.status === "upcoming"
              ? "Upcoming"
              : "";
      const statusHtml = status
        ? `<span style="font-size:11px;color:#a1a1aa;"> · ${escapeHtml(status)}</span>`
        : "";
      const desc = item.description
        ? `<div style="${MUTED};margin-top:2px;">${escapeHtml(item.description)}</div>`
        : "";
      return `<tr>
        <td style="padding:8px 12px 8px 0;width:72px;font-size:11px;color:#71717a;vertical-align:top;white-space:nowrap;">${escapeHtml(item.t)}</td>
        <td style="padding:8px 0;font-size:13px;color:#e4e4e7;vertical-align:top;border-left:2px solid rgba(255,255,255,0.12);padding-left:12px;">
          <strong style="color:#ffffff;">${escapeHtml(item.title)}</strong>${statusHtml}${desc}
        </td>
      </tr>`;
    })
    .join("");

  const textLines = artifact.items.map(
    (item) => `  ${item.t} — ${item.title}${item.status ? ` [${item.status}]` : ""}`,
  );

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Timeline")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table></div>`,
    text: [`${artifact.title ?? "Timeline"}`, ...textLines].join("\n"),
  };
}

function renderComparison(artifact: ComparisonArtifact): { html: string; text: string } {
  const cols = artifact.options
    .map((option) => {
      const metrics = option.metrics
        .map(
          (m) =>
            `<div style="margin-top:8px;"><div style="${MUTED}">${escapeHtml(m.label)}</div><div style="font-size:14px;font-weight:600;color:#ffffff;">${escapeHtml(m.value)}</div></div>`,
        )
        .join("");
      const subtitle = option.subtitle
        ? `<div style="${MUTED};margin-top:2px;">${escapeHtml(option.subtitle)}</div>`
        : "";
      return `<td style="width:${Math.floor(100 / Math.max(artifact.options.length, 1))}%;padding:0 8px 0 0;vertical-align:top;">
        <div style="padding:12px;background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
          <div style="font-size:13px;font-weight:600;color:#ffffff;">${escapeHtml(option.label)}</div>${subtitle}${metrics}
        </div>
      </td>`;
    })
    .join("");

  const textLines = artifact.options.flatMap((option) => [
    `  ${option.label}${option.subtitle ? ` (${option.subtitle})` : ""}`,
    ...option.metrics.map((m) => `    ${m.label}: ${m.value}`),
  ]);

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Comparison")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr>${cols}</tr></table></div>`,
    text: [`${artifact.title ?? "Comparison"}`, ...textLines].join("\n"),
  };
}

function renderFunnel(artifact: FunnelArtifact): { html: string; text: string } {
  const max = Math.max(...artifact.stages.map((s) => s.value), 1);
  const rows = artifact.stages
    .map((stage) => {
      const pct = Math.max(8, Math.round((stage.value / max) * 100));
      const hint = stage.hint
        ? `<div style="${MUTED};margin-top:2px;">${escapeHtml(stage.hint)}</div>`
        : "";
      return `<tr>
        <td style="padding:6px 0;font-size:12px;color:#e4e4e7;width:28%;vertical-align:middle;">${escapeHtml(stage.label)}${hint}</td>
        <td style="padding:6px 0;vertical-align:middle;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;"><tr>
            <td style="width:${pct}%;background:#3f3f46;border-radius:6px;padding:8px 10px;font-size:12px;font-weight:600;color:#ffffff;">${escapeHtml(String(stage.value))}</td>
            <td></td>
          </tr></table>
        </td>
      </tr>`;
    })
    .join("");

  const textLines = artifact.stages.map(
    (stage) => `  ${stage.label}: ${stage.value}${stage.hint ? ` (${stage.hint})` : ""}`,
  );

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Funnel")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table></div>`,
    text: [`${artifact.title ?? "Funnel"}`, ...textLines].join("\n"),
  };
}

function renderNews(artifact: NewsListArtifact): { html: string; text: string } {
  const rows = artifact.items
    .map((item) => {
      const meta = [item.source, item.publishedAt, item.sentiment].filter(Boolean).join(" · ");
      const metaHtml = meta
        ? `<div style="${MUTED};margin-top:2px;">${escapeHtml(meta)}</div>`
        : "";
      const title = item.url
        ? `<a href="${escapeHtml(item.url)}" style="color:#ffffff;text-decoration:underline;">${escapeHtml(item.title)}</a>`
        : escapeHtml(item.title);
      return `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e4e4e7;">${title}${metaHtml}</td></tr>`;
    })
    .join("");

  const textLines = artifact.items.map((item) => `  - ${item.title}${item.url ? ` (${item.url})` : ""}`);

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "News")}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table></div>`,
    text: [`${artifact.title ?? "News"}`, ...textLines].join("\n"),
  };
}

function renderMarkdown(artifact: MarkdownArtifact): { html: string; text: string } {
  const body = artifact.body.trim();
  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Notes")}</p>
      <pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.6;color:#e4e4e7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(body)}</pre></div>`,
    text: [`${artifact.title ?? "Notes"}`, body].join("\n"),
  };
}

/** Simple SVG sparkline — widely supported in modern mail clients. */
function renderTimeseries(artifact: TimeseriesChartArtifact): { html: string; text: string } {
  const seriesBlocks = artifact.series
    .map((series) => {
      const points = series.points.slice(-40);
      if (points.length === 0) return "";
      const values = points.map((p) => p.v);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const w = 280;
      const h = 64;
      const pad = 4;
      const path = points
        .map((p, i) => {
          const x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
          const y = h - pad - ((p.v - min) / span) * (h - pad * 2);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      const last = points[points.length - 1]!;
      const first = points[0]!;
      return `<div style="margin-top:12px;">
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:6px;">${escapeHtml(series.name)} · ${escapeHtml(String(last.v))} <span style="${MUTED}">(${escapeHtml(first.t)} → ${escapeHtml(last.t)})</span></div>
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(series.name)}">
          <path d="${path}" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>`;
    })
    .join("");

  const desc = artifact.description
    ? `<p style="${MUTED};margin:0 0 4px;">${escapeHtml(artifact.description)}</p>`
    : "";

  const textLines = artifact.series.map((series) => {
    const last = series.points[series.points.length - 1];
    return `  ${series.name}: ${last ? last.v : "—"} (${series.points.length} points)`;
  });

  return {
    html: `<div style="${CARD}"><p style="${TITLE}">${sectionTitle(artifact.title, "Chart")}</p>${desc}${seriesBlocks || `<p style="${MUTED}">No chart data.</p>`}</div>`,
    text: [`${artifact.title ?? "Chart"}`, ...textLines].join("\n"),
  };
}

function renderOne(artifact: RunArtifact): { html: string; text: string } {
  switch (artifact.type) {
    case "kpi_row":
      return renderKpi(artifact);
    case "data_table":
      return renderTable(artifact);
    case "ranking":
      return renderRanking(artifact);
    case "timeline":
      return renderTimeline(artifact);
    case "comparison":
      return renderComparison(artifact);
    case "funnel":
      return renderFunnel(artifact);
    case "news_list":
      return renderNews(artifact);
    case "markdown":
      return renderMarkdown(artifact);
    case "timeseries_chart":
      return renderTimeseries(artifact);
    default:
      return { html: "", text: "" };
  }
}

export function renderArtifactsForEmail(raw: unknown): { html: string; text: string } {
  const artifacts = normalizeRunArtifacts(raw);
  if (artifacts.length === 0) {
    return { html: "", text: "" };
  }

  const parts = artifacts.map(renderOne).filter((p) => p.html || p.text);
  return {
    html: `<div style="margin-top:8px;">${parts.map((p) => p.html).join("")}</div>`,
    text: ["", "Artifacts", ...parts.map((p) => p.text), ""].join("\n"),
  };
}
