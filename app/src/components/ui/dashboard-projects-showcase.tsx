import { DashboardSectionLink } from "@/components/ui/dashboard-section-link";
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
        "flex flex-col overflow-hidden rounded-2xl border-0 bg-muted/15 shadow-none dark:bg-muted/10",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4 max-sm:px-4 max-sm:py-3.5 sm:px-6">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-foreground max-sm:text-base">Projects</h2>
        <DashboardSectionLink href="/projects" label="View all" />
      </div>

      <div className="px-4 py-4 max-sm:px-3 max-sm:py-3 sm:px-5 sm:py-5">
        <SynaroProjectsCardsGrid
          projects={projects}
          showNewProject
          newProjectHref="/projects"
          cardVariant="embedded"
          className="grid-cols-2 gap-3 max-sm:gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
          newProjectClassName="max-sm:min-h-[8.5rem] max-sm:px-4 max-sm:py-6"
        />
      </div>
    </section>
  );
}
