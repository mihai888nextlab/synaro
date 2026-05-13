import type { LucideIcon } from "lucide-react";
import { Brain, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type SynaroProjectCardModel = {
  id: string;
  /** Segment for `/projects/[slug]` (project workspace). */
  slug: string;
  title: string;
  description: string;
  stack: string;
  /** Short relative time (e.g. `2m ago`). */
  updatedRelative: string;
  status: "running" | "stopped";
  icon: LucideIcon;
};

export const DEFAULT_SYNARO_PROJECT_CARDS: SynaroProjectCardModel[] = [
  {
    id: "1",
    slug: "peak",
    title: "PEAK — Athletic OS",
    description: "AI-powered athletic intelligence platform connecting training, biomechanics, and recovery.",
    stack: "Next.js",
    updatedRelative: "2m ago",
    status: "running",
    icon: Brain,
  },
  {
    id: "2",
    slug: "itecify",
    title: "iTECify — Edge stack",
    description: "Regional cache and programmable API gateway at the edge.",
    stack: "Next.js",
    updatedRelative: "14m ago",
    status: "running",
    icon: Zap,
  },
  {
    id: "3",
    slug: "synaro-internal",
    title: "Synaro — Control plane",
    description: "Internal workspace for policies, environments, and deployment previews.",
    stack: "Next.js · Postgres",
    updatedRelative: "6h ago",
    status: "stopped",
    icon: Sparkles,
  },
];

/** Running = emerald pill + dot; light = very soft mint (no translucent “dark slab”). */
export function SynaroProjectStatusPill({ status }: { status: SynaroProjectCardModel["status"] }) {
  if (status === "running") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
          /* Light: pale fill + muted border + saturated green glyph only on the dot/text */
          "border-emerald-200/70 bg-emerald-50 text-emerald-700",
          "dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-400",
        )}
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
          aria-hidden
        />
        running
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-border bg-muted text-muted-foreground dark:border-border/80 dark:bg-muted/30",
      )}
    >
      stopped
    </span>
  );
}

export function SynaroProjectCard({ project }: { project: SynaroProjectCardModel }) {
  const href = `/projects/${encodeURIComponent(project.slug)}`;
  const Icon = project.icon;

  return (
    <Link
      href={href}
      aria-label={`Open project: ${project.title}`}
      className={cn(
        "group flex flex-col rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm shadow-black/[0.06] transition-colors sm:p-[1.125rem]",
        "hover:border-border hover:shadow-black/[0.08] dark:border-border/55 dark:bg-card/90 dark:shadow-black/20 dark:hover:border-border/70",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition group-hover:bg-muted",
            "dark:border-border/60 dark:bg-muted/60",
          )}
          aria-hidden
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <SynaroProjectStatusPill status={project.status} />
      </div>

      <span className="mt-4 block text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground">
        {project.title}
      </span>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{project.description}</p>

      <hr className="my-4 border-0 border-t border-border/60 dark:border-border/45" />

      <div className="mt-auto flex items-end justify-between gap-3 text-xs">
        <span className="min-w-0 text-muted-foreground">
          {project.stack} · updated {project.updatedRelative}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground transition group-hover:text-foreground">
          <span className="font-normal">open</span>
          <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}

export function SynaroNewProjectCard({
  href = "/projects",
  onClick,
  className,
}: {
  href?: string;
  /** When set, the card acts as a button (e.g. opens a modal) instead of navigating. */
  onClick?: () => void;
  className?: string;
}) {
  const styles = cn(
    "flex min-h-[11.25rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-5 py-8 text-sm font-medium text-muted-foreground transition sm:min-h-[12rem]",
    "hover:border-border hover:bg-muted/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/55 dark:hover:bg-muted/15",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles}>
        + New project
      </button>
    );
  }

  return (
    <Link href={href} className={styles}>
      + New project
    </Link>
  );
}

export function SynaroProjectsCardsGrid({
  projects = DEFAULT_SYNARO_PROJECT_CARDS,
  showNewProject = true,
  newProjectHref = "/projects",
  onNewProjectClick,
  className,
}: {
  projects?: SynaroProjectCardModel[];
  showNewProject?: boolean;
  newProjectHref?: string;
  onNewProjectClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:gap-5",
        className,
      )}
    >
      {projects.map((p) => (
        <SynaroProjectCard key={p.id} project={p} />
      ))}
      {showNewProject ? (
        <SynaroNewProjectCard href={newProjectHref} onClick={onNewProjectClick} />
      ) : null}
    </div>
  );
}
