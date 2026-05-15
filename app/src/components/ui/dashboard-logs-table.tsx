import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type DashboardLogRow = {
  id: string;
  action: string;
  project: string;
  status: "done" | "running" | "stopped";
  /** Relative time label, e.g. "2m ago" */
  time: string;
};

export const DASHBOARD_PLACEHOLDER_LOGS: DashboardLogRow[] = [
  {
    id: "1",
    action: "AI edit — Add dark mode toggle",
    project: "PEAK",
    status: "done",
    time: "2m ago",
  },
  {
    id: "2",
    action: "Container restart",
    project: "iTECify",
    status: "running",
    time: "5m ago",
  },
  {
    id: "3",
    action: "Deploy preview — feature/auth-callback",
    project: "synaro-app",
    status: "running",
    time: "18m ago",
  },
  {
    id: "4",
    action: "Scheduled backup completed",
    project: "Core Platform",
    status: "done",
    time: "1h ago",
  },
  {
    id: "5",
    action: "Worker scale-down (idle)",
    project: "Edge Cache",
    status: "stopped",
    time: "2h ago",
  },
  {
    id: "6",
    action: "Policy sync — drift reconciled",
    project: "Acme Billing",
    status: "done",
    time: "3h ago",
  },
];

const LOG_PAGE_EXTRA_ROWS: DashboardLogRow[] = [
  {
    id: "7",
    action: "Database migration — v2 schema",
    project: "Core Platform",
    status: "done",
    time: "4h ago",
  },
  {
    id: "8",
    action: "CDN purge — marketing assets",
    project: "PEAK",
    status: "running",
    time: "5h ago",
  },
  {
    id: "9",
    action: "Webhook delivery retries exhausted",
    project: "Acme Billing",
    status: "stopped",
    time: "6h ago",
  },
  {
    id: "10",
    action: "SSL certificate renewed",
    project: "Edge Cache",
    status: "done",
    time: "8h ago",
  },
  {
    id: "11",
    action: "Preview environment garbage collection",
    project: "synaro-app",
    status: "running",
    time: "9h ago",
  },
  {
    id: "12",
    action: "Secrets rotated — API tokens",
    project: "iTECify",
    status: "done",
    time: "12h ago",
  },
];

/** Extended sample used on `/logs` (includes dashboard rows plus more history). */
export const LOG_PAGE_PLACEHOLDER_LOGS: DashboardLogRow[] = [...DASHBOARD_PLACEHOLDER_LOGS, ...LOG_PAGE_EXTRA_ROWS];

function StatusPill({ status }: { status: DashboardLogRow["status"] }) {
  const map = {
    done: {
      label: "done",
      className:
        "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/[0.06] dark:text-emerald-400",
    },
    running: {
      label: "running",
      className:
        "border-sky-200/90 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/[0.08] dark:text-sky-300",
    },
    stopped: {
      label: "stopped",
      className:
        "border-border/50 bg-muted/60 text-muted-foreground dark:border-border/80 dark:bg-muted/25",
    },
  } as const;

  const cfg = map[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}

const cardShell =
  "rounded-2xl border border-border/60 bg-card shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25";

export function DashboardLogsTable({
  logs = DASHBOARD_PLACEHOLDER_LOGS,
  className,
  title = "Recent activity",
  headerEnd,
  /** Omit title row / toolbar (e.g. `/logs` full-page list). */
  hideHeader = false,
  /** No outer card: no border, radius, or lifted surface — table sits flush on the page. */
  frameless = false,
}: {
  logs?: DashboardLogRow[];
  className?: string;
  title?: string;
  /** Right side of the header row (e.g. View logs on the dashboard). */
  headerEnd?: ReactNode;
  hideHeader?: boolean;
  frameless?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        frameless ? "border-0 bg-transparent shadow-none" : cardShell,
        className,
      )}
    >
      {!hideHeader ? (
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {headerEnd ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{headerEnd}</div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "pl-0 pr-3 sm:pr-4" : "px-5 sm:px-6",
                )}
              >
                Action
              </th>
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "px-3 sm:px-4" : "px-5 sm:px-6",
                )}
              >
                Project
              </th>
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "px-3 sm:px-4" : "px-5 sm:px-6",
                )}
              >
                Status
              </th>
              <th
                className={cn(
                  "py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "pl-3 pr-0 sm:pl-4" : "px-5 sm:px-6",
                )}
              >
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className={cn(
                    "py-10 text-center text-sm text-muted-foreground",
                    frameless ? "px-0" : "px-5 sm:px-6",
                  )}
                >
                  No projects yet. Create one from{" "}
                  <Link href="/projects" className="font-medium text-primary underline-offset-2 hover:underline">
                    Projects
                  </Link>
                  .
                </td>
              </tr>
            ) : null}
            {logs.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/25 dark:hover:bg-muted/10"
              >
                <td
                  className={cn(
                    "max-w-md py-3.5 font-medium text-foreground",
                    frameless ? "pl-0 pr-3 sm:pr-4" : "px-5 sm:px-6",
                  )}
                >
                  {row.action}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap py-3.5 text-muted-foreground",
                    frameless ? "px-3 sm:px-4" : "px-5 sm:px-6",
                  )}
                >
                  {row.project}
                </td>
                <td className={cn("py-3.5", frameless ? "px-3 sm:px-4" : "px-5 sm:px-6")}>
                  <StatusPill status={row.status} />
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap py-3.5 text-right tabular-nums text-muted-foreground",
                    frameless ? "pl-3 pr-0 sm:pl-4" : "px-5 sm:px-6",
                  )}
                >
                  {row.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
