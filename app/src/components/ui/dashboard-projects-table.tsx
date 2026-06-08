import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DashboardProjectRow = {
  id: string;
  name: string;
  slug: string;
  environment: string;
  status: "healthy" | "degraded" | "paused";
  lastActivity: string;
};

const PLACEHOLDER_PROJECTS: DashboardProjectRow[] = [
  {
    id: "1",
    name: "Core Platform",
    slug: "core-platform",
    environment: "Production",
    status: "healthy",
    lastActivity: "12 min ago",
  },
  {
    id: "2",
    name: "Acme Billing",
    slug: "acme-billing",
    environment: "Staging",
    status: "healthy",
    lastActivity: "3 h ago",
  },
  {
    id: "3",
    name: "Edge Cache",
    slug: "edge-cache",
    environment: "Production",
    status: "degraded",
    lastActivity: "1 h ago",
  },
  {
    id: "4",
    name: "Data pipeline",
    slug: "data-pipeline",
    environment: "Development",
    status: "paused",
    lastActivity: "Yesterday",
  },
];

function StatusBadge({ status }: { status: DashboardProjectRow["status"] }) {
  const labels = {
    healthy: "Healthy",
    degraded: "Degraded",
    paused: "Paused",
  } as const;

  const styles = {
    healthy:
      "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
    degraded:
      "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400",
    paused:
      "border-border/50 bg-muted/70 text-muted-foreground dark:border-border/60 dark:bg-muted dark:text-muted-foreground",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

export function DashboardProjectsTable({
  projects = PLACEHOLDER_PROJECTS,
  className,
  secondaryLink,
}: {
  projects?: DashboardProjectRow[];
  className?: string;
  /** Primary-style text action (e.g. “+ Add project”) beside the outlined button */
  secondaryLink?: { label: string; href: string };
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Placeholder data · wire to API when backends are connected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {secondaryLink ? (
            <Link
              href={secondaryLink.href}
              className="text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
            >
              {secondaryLink.label}
            </Link>
          ) : null}
          <Button variant="outline" size="sm" className="shrink-0 gap-2 rounded-xl" asChild>
            <Link href="/projects">
              View all
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 dark:bg-muted/20">
              <th className="px-4 py-3 font-medium text-muted-foreground sm:px-6">Name</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Slug</th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">
                Environment
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="hidden px-4 py-3 text-right font-medium text-muted-foreground lg:table-cell">
                Last activity
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/50 transition-colors last:border-b-0",
                  i % 2 === 1 && "bg-muted/20 dark:bg-muted/10",
                  "hover:bg-muted/35 dark:hover:bg-muted/15",
                )}
              >
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">{row.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-xs">{row.slug}</code>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {row.environment}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                  {row.lastActivity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
