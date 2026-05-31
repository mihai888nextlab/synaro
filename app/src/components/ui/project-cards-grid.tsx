import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2, Brain, MoreVertical, Sparkles, Trash2, Zap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const SYNARO_PROJECT_CARD_ICONS = {
  brain: Brain,
  zap: Zap,
  sparkles: Sparkles,
} as const;

export type SynaroProjectCardIconKey = keyof typeof SYNARO_PROJECT_CARD_ICONS;

/** Mirrors Prisma `EnvironmentStatus` — persisted Docker/runtime state for the project workspace. */
export type SynaroProjectEnvironmentStatus =
  | "INACTIVE"
  | "PROVISIONING"
  | "RUNNING"
  | "STOPPED"
  | "ERROR";

export type SynaroProjectCardModel = {
  id: string;
  /** Segment for `/projects/[slug]` (project workspace). */
  slug: string;
  title: string;
  description: string;
  /** Secondary line (e.g. stack hint). */
  stack: string;
  /** Short relative time (e.g. `2m ago`). */
  updatedRelative: string;
  /** Docker / dev-container state from the app database (synced when environments are provisioned). */
  environmentStatus: SynaroProjectEnvironmentStatus;
  icon: SynaroProjectCardIconKey;
  /** When set, the signed-in viewer owns the project and may delete it from the grid menu. */
  viewerCanDelete?: boolean;
};

export const DEFAULT_SYNARO_PROJECT_CARDS: SynaroProjectCardModel[] = [
  {
    id: "1",
    slug: "peak",
    title: "PEAK — Athletic OS",
    description: "AI-powered athletic intelligence platform connecting training, biomechanics, and recovery.",
    stack: "Next.js",
    updatedRelative: "2m ago",
    environmentStatus: "RUNNING",
    icon: "brain",
  },
  {
    id: "2",
    slug: "itecify",
    title: "iTECify — Edge stack",
    description: "Regional cache and programmable API gateway at the edge.",
    stack: "Next.js",
    updatedRelative: "14m ago",
    environmentStatus: "RUNNING",
    icon: "zap",
  },
  {
    id: "3",
    slug: "synaro-internal",
    title: "Synaro — Control plane",
    description: "Internal workspace for policies, environments, and deployment previews.",
    stack: "Next.js · Postgres",
    updatedRelative: "6h ago",
    environmentStatus: "STOPPED",
    icon: "sparkles",
  },
];

function dockerPillVisual(
  environmentStatus: SynaroProjectEnvironmentStatus,
): { dot: React.ReactNode; label: string; className: string } {
  if (environmentStatus === "RUNNING") {
    return {
      dot: (
        <span
          className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
          aria-hidden
        />
      ),
      label: "running",
      className: cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-emerald-200/70 bg-emerald-50 text-emerald-700",
        "dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-400",
      ),
    };
  }
  if (environmentStatus === "PROVISIONING") {
    return {
      dot: (
        <span
          className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500 dark:bg-amber-400"
          aria-hidden
        />
      ),
      label: "starting",
      className: cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-amber-200/80 bg-amber-50 text-amber-900",
        "dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200",
      ),
    };
  }
  if (environmentStatus === "ERROR") {
    return {
      dot: <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />,
      label: "error",
      className: cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-destructive/35 bg-destructive/10 text-destructive",
        "dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive",
      ),
    };
  }
  if (environmentStatus === "STOPPED") {
    return {
      dot: null,
      label: "stopped",
      className: cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-border bg-muted text-muted-foreground dark:border-border/80 dark:bg-muted/30",
      ),
    };
  }
  return {
    dot: null,
    label: "idle",
    className: cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
      "border-border bg-muted text-muted-foreground dark:border-border/80 dark:bg-muted/30",
    ),
  };
}

/** Clickable Docker control on the projects page, or static pill elsewhere. */
export function SynaroProjectDockerPill({
  environmentStatus,
  interactive = false,
  busy = false,
  onPress,
  className: classNameProp,
  labelClassName,
}: {
  environmentStatus: SynaroProjectEnvironmentStatus;
  interactive?: boolean;
  busy?: boolean;
  onPress?: (action: "start" | "stop") => void;
  className?: string;
  labelClassName?: string;
}) {
  const { dot, label, className } = dockerPillVisual(environmentStatus);
  const nextAction: "start" | "stop" = environmentStatus === "RUNNING" ? "stop" : "start";
  const title =
    nextAction === "stop"
      ? "Stop Docker container"
      : environmentStatus === "ERROR"
        ? "Retry: remove failed environment and start a new container"
        : "Start Docker container";

  const pillLabel = <span className={labelClassName}>{label}</span>;

  if (!interactive || !onPress) {
    return (
      <span className={cn(className, classNameProp)} title={label}>
        {dot}
        {pillLabel}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={`${title}. Current state: ${environmentStatus}.`}
      disabled={busy || environmentStatus === "PROVISIONING"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress(nextAction);
      }}
      className={cn(
        className,
        classNameProp,
        "cursor-pointer transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/70 disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {busy ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span className={labelClassName}>working…</span>
        </span>
      ) : (
        <>
          {dot}
          {pillLabel}
        </>
      )}
    </button>
  );
}

/** Non-interactive status pill (e.g. dashboard showcase). */
export function SynaroProjectStatusPill({
  environmentStatus,
}: {
  environmentStatus: SynaroProjectEnvironmentStatus;
}) {
  const { dot, label, className } = dockerPillVisual(environmentStatus);
  return (
    <span className={className}>
      {dot}
      {label}
    </span>
  );
}

export function SynaroProjectCard({
  project,
  dockerInteractive = false,
  dockerBusyId = null,
  onDockerClick,
  cardMoreMenu = false,
  onDeleteProject,
  variant = "default",
}: {
  project: SynaroProjectCardModel;
  /** When true, the Docker pill is a button that starts/stops the container (projects page only). */
  dockerInteractive?: boolean;
  /** Project id currently performing a Docker action (shows spinner on that pill). */
  dockerBusyId?: string | null;
  onDockerClick?: (projectId: string, action: "start" | "stop") => void;
  /** Kebab menu (analytics, delete for owners) — used on `/projects`. */
  cardMoreMenu?: boolean;
  onDeleteProject?: (projectId: string) => void | Promise<void>;
  /** `embedded` = lighter surface for dashboard / nested layouts (no “card on card”). */
  variant?: "default" | "embedded";
}) {
  const href = `/projects/${encodeURIComponent(project.slug)}`;
  const analyticsHref = `/projects/${encodeURIComponent(project.slug)}/analytics`;
  const Icon = SYNARO_PROJECT_CARD_ICONS[project.icon] ?? Brain;
  const busy = dockerBusyId === project.id;

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl text-left transition-colors",
        variant === "embedded"
          ? "overflow-hidden border-0 bg-muted/20 p-4 shadow-none max-sm:p-3 hover:bg-muted/30 dark:bg-muted/10 dark:hover:bg-muted/20 sm:p-[1.125rem]"
          : "border border-border/70 bg-card p-4 shadow-sm shadow-black/[0.06] sm:p-[1.125rem] hover:border-border hover:shadow-black/[0.08] dark:border-border/55 dark:bg-card/90 dark:shadow-black/20 dark:hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition group-hover:bg-muted",
            "dark:border-border/60 dark:bg-muted/60",
            variant === "embedded" && "max-sm:h-8 max-sm:w-8",
          )}
          aria-hidden
        >
          <Icon className={cn("size-4 shrink-0", variant === "embedded" && "max-sm:size-3.5")} />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5" dir="ltr">
          <div className="flex shrink-0 items-center">
            <SynaroProjectDockerPill
              environmentStatus={project.environmentStatus}
              interactive={dockerInteractive}
              busy={busy}
              onPress={
                onDockerClick
                  ? (action) => {
                      onDockerClick(project.id, action);
                    }
                  : undefined
              }
            />
          </div>
          {cardMoreMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg p-0 leading-none text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:block"
                  aria-label={`More options for ${project.title}`}
                >
                  <MoreVertical className="size-4 shrink-0" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/70 p-1" sideOffset={6}>
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                  <Link href={analyticsHref} className="flex items-center gap-2">
                    <BarChart2 className="size-4 shrink-0" aria-hidden />
                    Analytics
                  </Link>
                </DropdownMenuItem>
                {project.viewerCanDelete && onDeleteProject ? (
                  <>
                    <DropdownMenuSeparator className="bg-border/60" />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        if (
                          !window.confirm(
                            `Delete “${project.title}”? This removes the project and its Docker environments. This cannot be undone.`,
                          )
                        ) {
                          return;
                        }
                        void onDeleteProject(project.id);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="size-4 shrink-0" aria-hidden />
                        Delete project
                      </span>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <Link
        href={href}
        data-onboarding="project-card-link"
        aria-label={`Open project: ${project.title}`}
        className={cn(
          "mt-4 block min-w-0 flex-1 rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
          variant === "embedded" && "max-sm:mt-2",
        )}
      >
        <span
          className={cn(
            "block font-semibold leading-snug tracking-tight text-foreground",
            variant === "embedded"
              ? "truncate text-[0.9375rem] sm:text-[1.0625rem]"
              : "text-[1.0625rem]",
          )}
        >
          {project.title}
        </span>
        {variant === "embedded" ? (
          <p className="mt-1 text-[0.65rem] text-muted-foreground sm:hidden">{project.updatedRelative}</p>
        ) : null}
        <p
          className={cn(
            "mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground",
            variant === "embedded" && "hidden sm:block",
          )}
        >
          {project.description}
        </p>

        <hr
          className={cn(
            "my-4 border-0 border-t border-border/60 dark:border-border/45",
            variant === "embedded" && "hidden sm:block",
          )}
        />

        <div
          className={cn(
            "flex items-end justify-between gap-3 text-xs",
            variant === "embedded" && "hidden sm:flex",
          )}
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {project.stack} · updated {project.updatedRelative}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground transition group-hover:text-foreground">
            <span className="font-normal">open</span>
            <span aria-hidden>→</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

export function SynaroNewProjectCard({
  href = "/projects",
  onClick,
  className,
  variant = "default",
}: {
  href?: string;
  /** When set, the card acts as a button (e.g. opens a modal) instead of navigating. */
  onClick?: () => void;
  className?: string;
  variant?: "default" | "embedded";
}) {
  const styles = cn(
    "flex min-h-[11.25rem] cursor-pointer flex-col items-center justify-center rounded-xl px-5 py-8 text-sm font-medium text-muted-foreground transition sm:min-h-[12rem]",
    variant === "embedded"
      ? "border border-dashed border-border/40 bg-transparent hover:border-border/60 hover:bg-muted/25 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/35 dark:hover:bg-muted/15"
      : "border border-dashed border-border/70 hover:border-border hover:bg-muted/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/55 dark:hover:bg-muted/15",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles} data-onboarding="new-project">
        + New project
      </button>
    );
  }

  return (
    <Link href={href} className={styles} data-onboarding="new-project">
      + New project
    </Link>
  );
}

export function SynaroProjectsCardsGrid({
  projects = DEFAULT_SYNARO_PROJECT_CARDS,
  showNewProject = true,
  newProjectHref = "/projects",
  onNewProjectClick,
  dockerInteractive = false,
  dockerBusyId = null,
  onDockerClick,
  cardMoreMenu = false,
  onProjectDelete,
  cardVariant = "default",
  className,
  newProjectClassName,
}: {
  projects?: SynaroProjectCardModel[];
  showNewProject?: boolean;
  newProjectHref?: string;
  onNewProjectClick?: () => void;
  dockerInteractive?: boolean;
  dockerBusyId?: string | null;
  onDockerClick?: (projectId: string, action: "start" | "stop") => void;
  cardMoreMenu?: boolean;
  onProjectDelete?: (projectId: string) => void | Promise<void>;
  /** Lighter project tiles for dashboard-style panels. */
  cardVariant?: "default" | "embedded";
  className?: string;
  newProjectClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:gap-5",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {projects.map((p) => (
          <motion.div
            key={p.id}
            layout
            className="min-w-0"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { type: "spring", stiffness: 420, damping: 28, mass: 0.85 },
            }}
            exit={{
              scale: [1, 1.04, 0],
              opacity: [1, 1, 0],
              transition: {
                duration: 0.32,
                times: [0, 0.2, 1],
                ease: "easeOut",
              },
            }}
          >
            <SynaroProjectCard
              project={p}
              variant={cardVariant}
              dockerInteractive={dockerInteractive}
              dockerBusyId={dockerBusyId}
              onDockerClick={onDockerClick}
              cardMoreMenu={cardMoreMenu}
              onDeleteProject={onProjectDelete}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {showNewProject ? (
        <SynaroNewProjectCard
          href={newProjectHref}
          onClick={onNewProjectClick}
          variant={cardVariant}
          className={newProjectClassName}
        />
      ) : null}
    </div>
  );
}
