"use client";

import type { ReactNode, KeyboardEvent } from "react";
import { useRouter } from "next/router";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export type DashboardLogRow = {
  id: string;
  action: string;
  project: string;
  status: "done" | "running" | "stopped";
  /** Display time (relative on dashboard, full timestamp on `/logs`). */
  time: string;
  /** Full timestamp for hover / accessibility. */
  timeTitle?: string;
  /** ISO-8601 instant for `<time dateTime>`. */
  occurredAt?: string;
  /** Deep link to the related project workspace, agent, or agent run. */
  href?: string | null;
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

function useLogNavigation(href: string | null | undefined) {
  const router = useRouter();

  const navigate = () => {
    if (!href) return;
    void router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!href) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  };

  return { navigate, onKeyDown, interactive: Boolean(href) };
}

function LogRowCard({
  row,
  frameless,
}: {
  row: DashboardLogRow;
  frameless: boolean;
}) {
  const { t } = useTranslation();
  const { navigate, onKeyDown, interactive } = useLogNavigation(row.href);

  return (
    <article
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? navigate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      aria-label={interactive ? t("logs.openRelated", { action: row.action }) : undefined}
      className={cn(
        "border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/25 dark:hover:bg-muted/10",
        frameless ? "px-3 py-3.5 sm:px-4" : "px-4 py-3.5 sm:px-5",
        interactive &&
          "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/70",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium leading-snug text-foreground",
          interactive && "underline-offset-2 group-hover:underline",
        )}
      >
        {row.action}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{row.project}</span>
        <StatusPill status={row.status} />
        <time
          className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground"
          dateTime={row.occurredAt}
          title={row.timeTitle}
        >
          {row.time}
        </time>
      </div>
    </article>
  );
}

function LogTableRow({
  row,
  frameless,
}: {
  row: DashboardLogRow;
  frameless: boolean;
}) {
  const { t } = useTranslation();
  const { navigate, onKeyDown, interactive } = useLogNavigation(row.href);

  return (
    <tr
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? navigate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      aria-label={interactive ? t("logs.openRelated", { action: row.action }) : undefined}
      className={cn(
        "border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/25 dark:hover:bg-muted/10",
        interactive &&
          "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring/70",
      )}
    >
      <td
        className={cn(
          "max-w-md py-3.5 font-medium text-foreground",
          frameless ? "pl-0 pr-3 sm:pr-4" : "px-5 sm:px-6",
          interactive && "underline-offset-2 hover:underline",
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
        title={row.timeTitle}
      >
        <time dateTime={row.occurredAt}>{row.time}</time>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: DashboardLogRow["status"] }) {
  const { t } = useTranslation();
  const map = {
    done: {
      label: t("logs.statusDone"),
      className:
        "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/[0.06] dark:text-emerald-400",
    },
    running: {
      label: t("logs.statusRunning"),
      className:
        "border-sky-200/90 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/[0.08] dark:text-sky-300",
    },
    stopped: {
      label: t("logs.statusStopped"),
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
  title,
  headerEnd,
  emptyMessage,
  /** Omit title row / toolbar (e.g. `/logs` full-page list). */
  hideHeader = false,
  /** No outer card: no border, radius, or lifted surface — table sits flush on the page. */
  frameless = false,
  /** Show full list height (dashboard customize mode). */
  expandContent = false,
}: {
  logs?: DashboardLogRow[];
  className?: string;
  title?: string;
  /** Right side of the header row (e.g. View logs on the dashboard). */
  headerEnd?: ReactNode;
  emptyMessage?: string;
  hideHeader?: boolean;
  frameless?: boolean;
  expandContent?: boolean;
}) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("dashboard.activityTitle");
  const resolvedEmptyMessage = emptyMessage ?? t("dashboard.noLogsBody");
  const isEmpty = logs.length === 0;

  return (
    <section
      className={cn(
        "flex flex-col",
        expandContent ? "min-h-0 overflow-visible" : "min-h-0 overflow-hidden",
        frameless ? "border-0 bg-transparent shadow-none" : cardShell,
        className,
      )}
    >
      {!hideHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 max-lg:px-4 max-lg:py-3.5 sm:px-6">
          <h2 className="min-w-0 text-lg font-semibold tracking-tight text-foreground max-lg:text-base">{resolvedTitle}</h2>
          {headerEnd ? <div className="flex shrink-0 items-center">{headerEnd}</div> : null}
        </div>
      ) : null}

      {isEmpty ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col items-center justify-center text-center",
            hideHeader ? "px-4 py-16 max-lg:py-12 sm:py-24" : "px-5 py-12 max-lg:px-4 max-lg:py-10 sm:px-6 sm:py-16",
          )}
        >
          <p className="text-base font-medium text-foreground">{t("dashboard.noLogsTitle")}</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground max-lg:px-2">{resolvedEmptyMessage}</p>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "lg:hidden",
              expandContent ? "overflow-visible" : "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            )}
          >
            {logs.map((row) => (
              <LogRowCard key={row.id} row={row} frameless={frameless} />
            ))}
          </div>
          <div
            className={cn(
              "hidden lg:block",
              expandContent ? "overflow-visible" : "min-h-0 flex-1 overflow-x-auto overflow-y-auto",
            )}
          >
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "pl-0 pr-3 sm:pr-4" : "px-5 sm:px-6",
                )}
              >
                {t("logs.columnAction")}
              </th>
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "px-3 sm:px-4" : "px-5 sm:px-6",
                )}
              >
                {t("logs.columnProject")}
              </th>
              <th
                className={cn(
                  "py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "px-3 sm:px-4" : "px-5 sm:px-6",
                )}
              >
                {t("logs.columnStatus")}
              </th>
              <th
                className={cn(
                  "py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground",
                  frameless ? "pl-3 pr-0 sm:pl-4" : "px-5 sm:px-6",
                )}
              >
                {t("logs.columnTime")}
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <LogTableRow key={row.id} row={row} frameless={frameless} />
            ))}
          </tbody>
        </table>
          </div>
        </>
      )}
    </section>
  );
}
