"use client";

import { DashboardAgentsShowcase } from "@/components/ui/dashboard-agents-showcase";
import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { DashboardProjectsShowcase } from "@/components/ui/dashboard-projects-showcase";
import { DEFAULT_SYNARO_PROJECT_CARDS } from "@/components/ui/project-cards-grid";
import {
  showcaseSectionClass,
  widgetChildClass,
  widgetRootClass,
} from "@/components/ui/dashboard/widget-layout-utils";

export function ProjectsShowcaseWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const projects = variant === "preview" ? DEFAULT_SYNARO_PROJECT_CARDS.slice(0, 2) : data.projects;
  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <DashboardProjectsShowcase
        projects={projects}
        layoutMode={layoutMode}
        className={widgetChildClass(layoutMode)}
      />
    </div>
  );
}

export function AgentsShowcaseWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  return (
    <div className={widgetRootClass(layoutMode, variant === "preview")}>
      <DashboardAgentsShowcase
        agents={variant === "preview" ? [] : data.agents}
        layoutMode={layoutMode}
        className={widgetChildClass(layoutMode)}
      />
    </div>
  );
}
