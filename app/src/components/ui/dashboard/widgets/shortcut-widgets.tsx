"use client";

import Link from "next/link";
import {
  Bot,
  Folder,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

import type { DashboardWidgetRenderProps } from "@/components/ui/dashboard/widget-render-props";
import { SynaroAgentCard } from "@/components/ui/agent-cards-grid";
import { SynaroProjectCard } from "@/components/ui/project-cards-grid";
import { usePageShortcutOptions } from "@/lib/dashboard/widget-registry-meta";
import type { PageShortcutRoute } from "@/lib/dashboard/layout-schema";
import { cn } from "@/lib/utils";

const PAGE_ICONS: Record<PageShortcutRoute, LucideIcon> = {
  projects: Folder,
  agents: Bot,
  logs: ScrollText,
  settings: Settings,
  api_keys: KeyRound,
  documentation: BookOpen,
};

function shortcutShell(className?: string, fluid?: boolean) {
  return cn(
    "flex min-w-0 flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:border-border hover:bg-muted/20 dark:border-border/50 dark:bg-card/90",
    fluid ? "h-auto" : "h-full",
    className,
  );
}

export function PageShortcutWidget({ widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const fluid = layoutMode === "fluid";
  const pageShortcutOptions = usePageShortcutOptions();
  const route = (widget.config as { route?: PageShortcutRoute } | undefined)?.route ?? "projects";
  const option = pageShortcutOptions.find((entry) => entry.route === route) ?? pageShortcutOptions[0]!;
  const Icon = PAGE_ICONS[option.route] ?? LayoutDashboard;

  return (
    <Link
      href={option.href}
      className={shortcutShell(variant === "preview" ? "pointer-events-none" : undefined, fluid)}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="mt-auto pt-4">
        <p className="font-semibold text-foreground">{option.label}</p>
        <p className="text-xs text-muted-foreground">Open page</p>
      </div>
    </Link>
  );
}

export function ProjectShortcutWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const projectId = (widget.config as { projectId?: string } | undefined)?.projectId;
  const project =
    data.projects.find((entry) => entry.id === projectId) ??
    data.projects[0] ??
    null;

  if (!project) {
    return (
      <div
        className={shortcutShell(
          "items-center justify-center text-center text-sm text-muted-foreground",
          layoutMode === "fluid",
        )}
      >
        Pick a project when adding this widget
      </div>
    );
  }

  return (
    <div className={cn(layoutMode === "grid" ? "h-full" : "h-auto", variant === "preview" && "pointer-events-none scale-[0.96]")}>
      <SynaroProjectCard project={project} variant="embedded" />
    </div>
  );
}

export function AgentShortcutWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
  const agent = data.agents.find((entry) => entry.id === agentId) ?? data.agents[0] ?? null;

  if (!agent) {
    return (
      <div className={shortcutShell("items-center justify-center text-center text-sm text-muted-foreground", layoutMode === "fluid")}>
        Pick an agent when adding this widget
      </div>
    );
  }

  return (
    <div className={cn(layoutMode === "grid" ? "h-full" : "h-auto", variant === "preview" && "pointer-events-none scale-[0.96]")}>
      <SynaroAgentCard agent={agent} variant="embedded" />
    </div>
  );
}

export function ApiKeysSummaryWidget({ data, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const count = variant === "preview" ? 2 : data.apiKeysCount;
  return (
    <Link
      href="/settings/api-keys"
      className={shortcutShell(variant === "preview" ? "pointer-events-none" : undefined, layoutMode === "fluid")}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground">
        <KeyRound className="size-5" aria-hidden />
      </div>
      <div className="mt-auto pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">API keys</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{count === 1 ? "active key" : "active keys"}</p>
      </div>
    </Link>
  );
}
