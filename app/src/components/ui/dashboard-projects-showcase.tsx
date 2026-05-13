import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import {
  DEFAULT_SYNARO_PROJECT_CARDS,
  SynaroProjectsCardsGrid,
} from "@/components/ui/project-cards-grid";
import { cn } from "@/lib/utils";

/** @deprecated Prefer importing `SynaroProjectCardModel` from `project-cards-grid`. */
export type DashboardProjectShowcaseItem = SynaroProjectCardModel;

export function DashboardProjectsShowcase({
  projects = DEFAULT_SYNARO_PROJECT_CARDS,
  className,
}: {
  projects?: SynaroProjectCardModel[];
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

      <div className="p-5 sm:p-6">
        <SynaroProjectsCardsGrid projects={projects} showNewProject newProjectHref="/projects" />
      </div>
    </section>
  );
}
