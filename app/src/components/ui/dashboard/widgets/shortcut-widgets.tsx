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
import { InteractiveAgentCardWidget } from "@/components/ui/dashboard/widgets/agent-widgets";
import { SynaroProjectCard } from "@/components/ui/project-cards-grid";
import { useTranslation } from "@/components/ui/locale-provider";
import { usePageShortcutOptions } from "@/lib/dashboard/widget-registry-meta";
import type { PageShortcutRoute } from "@/lib/dashboard/layout-schema";
import { cn } from "@/lib/utils";
import { getWidgetDensity } from "@/lib/dashboard/widget-size-utils";

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
  const density = getWidgetDensity(widget.w, widget.h);
  const pageShortcutOptions = usePageShortcutOptions();
  const route = (widget.config as { route?: PageShortcutRoute } | undefined)?.route ?? "projects";
  const option = pageShortcutOptions.find((entry) => entry.route === route) ?? pageShortcutOptions[0]!;
  const Icon = PAGE_ICONS[option.route] ?? LayoutDashboard;

  return (
    <Link
      href={option.href}
      className={shortcutShell(variant === "preview" ? "pointer-events-none" : undefined, fluid)}
    >
      <div className={cn("flex items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground", density === "compact" ? "size-8" : "size-10")}>
        <Icon className={cn("aria-hidden", density === "compact" ? "size-4" : "size-5")} aria-hidden />
      </div>
      <div className={cn("mt-auto", density === "compact" ? "pt-2" : "pt-4")}>
        <p className={cn("font-semibold text-foreground", density === "compact" && "text-sm")}>{option.label}</p>
        {density !== "compact" ? <p className="text-xs text-muted-foreground">Open page</p> : null}
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

export function AgentShortcutWidget(props: DashboardWidgetRenderProps) {
  const { t } = useTranslation();
  return (
    <InteractiveAgentCardWidget
      {...props}
      emptyNoSelectMessage={t("widgets.types.agent_shortcut.noAgentSelected")}
      emptyNotFoundMessage={t("widgets.types.agent_shortcut.agentNotFound")}
      previewName={t("widgets.types.agent_shortcut.previewAgentName")}
    />
  );
}

export function ApiKeysSummaryWidget({ data, widget, variant, layoutMode = "grid" }: DashboardWidgetRenderProps) {
  const count = variant === "preview" ? 2 : data.apiKeysCount;
  const density = getWidgetDensity(widget.w, widget.h);

  return (
    <Link
      href="/settings/security#api-keys"
      className={shortcutShell(variant === "preview" ? "pointer-events-none" : undefined, layoutMode === "fluid")}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground",
          density === "compact" ? "size-8" : "size-10",
        )}
      >
        <KeyRound className={cn("aria-hidden", density === "compact" ? "size-4" : "size-5")} aria-hidden />
      </div>
      <div className={cn("mt-auto", density === "compact" ? "pt-2" : "pt-4")}>
        <p
          className={cn(
            "font-medium uppercase tracking-[0.08em] text-muted-foreground",
            density === "compact" ? "text-[0.65rem]" : "text-xs",
          )}
        >
          API keys
        </p>
        <p
          className={cn(
            "font-semibold tabular-nums text-foreground",
            density === "compact" ? "mt-1 text-2xl" : "mt-1 text-3xl",
          )}
        >
          {count}
        </p>
        {density !== "compact" ? (
          <p className="text-xs text-muted-foreground">{count === 1 ? "active key" : "active keys"}</p>
        ) : null}
      </div>
    </Link>
  );
}
