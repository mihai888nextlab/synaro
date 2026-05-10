import type { LucideIcon } from "lucide-react";
import { ArrowRight, Brain, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardProjectShowcaseItem = {
  id: string;
  /** URL segment for `/projects/[slug]/analytics`. */
  slug: string;
  title: string;
  description: string;
  stack: string;
  updated: string;
  status: "running" | "stopped";
  icon: LucideIcon;
};

const DEFAULT_PROJECTS: DashboardProjectShowcaseItem[] = [
  {
    id: "1",
    slug: "peak",
    title: "PEAK — Athletic OS",
    description: "Performance tracking and coach workflows. Placeholder copy for the dashboard preview.",
    stack: "Next.js",
    updated: "2m ago",
    status: "running",
    icon: Brain,
  },
  {
    id: "2",
    slug: "itecify",
    title: "iTECify — Edge stack",
    description: "Regional cache and API gateway. Replace with live project metadata from your API.",
    stack: "Node · Docker",
    updated: "15m ago",
    status: "running",
    icon: Zap,
  },
  {
    id: "3",
    slug: "synaro",
    title: "Synaro — Control plane",
    description: "Internal workspace for policies, environments, and deployment previews.",
    stack: "Next.js · Postgres",
    updated: "1h ago",
    status: "stopped",
    icon: Sparkles,
  },
];

/** Status styles aligned with `DashboardLogsTable` pills (running = sky, stopped = muted). */
function ProjectStatusPill({ status }: { status: DashboardProjectShowcaseItem["status"] }) {
  const map = {
    running: {
      label: "running",
      className:
        "border-sky-500/45 bg-sky-500/[0.08] text-sky-700 dark:border-sky-500/40 dark:text-sky-300",
    },
    stopped: {
      label: "stopped",
      className:
        "border-border bg-muted/40 text-muted-foreground dark:border-border/80 dark:bg-muted/25",
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

function ProjectCard({ project }: { project: DashboardProjectShowcaseItem }) {
  const Icon = project.icon;
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-border/70 bg-muted p-4 transition-colors",
        "hover:bg-muted/80 dark:hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:bg-muted"
          aria-hidden
        >
          <Icon className="size-4" />
        </div>
        <ProjectStatusPill status={project.status} />
      </div>
      <h3 className="mt-4 text-sm font-semibold leading-snug tracking-tight text-foreground">
        {project.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {project.description}
      </p>
      <div className="my-4 h-px w-full bg-border/60 dark:bg-border/50" />
      <div className="mt-auto flex items-end justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0">
          {project.stack} · updated {project.updated}
        </span>
        <Link
          href={`/projects/${encodeURIComponent(project.slug)}/analytics`}
          className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground underline-offset-4 transition hover:text-primary hover:underline"
        >
          open
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function DashboardProjectsShowcase({
  projects = DEFAULT_PROJECTS,
  className,
}: {
  projects?: DashboardProjectShowcaseItem[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-black/[0.06] dark:border-border/50 dark:bg-card/90 dark:shadow-black/25",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Projects</h2>
        <Button variant="outline" size="sm" className="shrink-0 rounded-xl text-muted-foreground" asChild>
          <Link href="/projects">
            View all <span aria-hidden>→</span>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:gap-4 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <Link
          href="/projects"
          className={cn(
            "flex min-h-[188px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-5 py-8 text-sm font-medium text-muted-foreground transition",
            "hover:border-border hover:bg-muted/25 hover:text-foreground dark:border-border/50 dark:hover:bg-muted/10",
          )}
        >
          + New project
        </Link>
      </div>
    </section>
  );
}
