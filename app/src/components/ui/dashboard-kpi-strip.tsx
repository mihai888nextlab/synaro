import { cn } from "@/lib/utils";

/** Matches `DashboardLogsTable` outer shell for visual parity. */
const kpiCardShell =
  "flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25 max-sm:px-4 max-sm:py-3 sm:px-6 sm:py-5";

export type DashboardKpiItem = {
  label: string;
  value: string;
  foot: string;
  /** Footer uses emerald (same accent family as “done” / positive trends in activity). */
  footPositive?: boolean;
};

const DEFAULT_KPIS: DashboardKpiItem[] = [
  { label: "Projects", value: "3", foot: "↑ 1 this week", footPositive: true },
  { label: "Running now", value: "2", foot: "PEAK, iTECify" },
  { label: "AI actions", value: "47", foot: "↑ 12 today", footPositive: true },
  { label: "Uptime", value: "99.8%", foot: "Last 30 days" },
];

export function DashboardKpiStrip({
  items = DEFAULT_KPIS,
  className,
}: {
  items?: DashboardKpiItem[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <article key={item.label} className={kpiCardShell}>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground max-sm:text-[0.65rem]">
            {item.label}
          </p>
          <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-foreground max-sm:mt-2 max-sm:text-2xl sm:text-[2rem] sm:leading-none">
            {item.value}
          </p>
          <p
            className={cn(
              "mt-auto pt-5 text-xs leading-relaxed text-muted-foreground max-sm:pt-3 max-sm:text-[0.65rem] max-sm:leading-snug sm:pt-6",
              item.footPositive && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {item.foot}
          </p>
        </article>
      ))}
    </div>
  );
}
