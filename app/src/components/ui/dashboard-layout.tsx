"use client";

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { BookOpen, CircleHelp, HomeIcon, Menu, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardSidebar, usePersistentSidebarCollapse } from "@/components/ui/dashboard-sidebar";
import { DashboardNotifications } from "@/components/ui/dashboard-notifications";
import { AiBackgroundTaskPill } from "@/components/ui/ai-background-task";
import {
  AgentActiveRunsPill,
  AgentSpeechStopButton,
} from "@/components/ui/agent-background-runs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useOnboarding } from "@/components/ui/onboarding";
import { useTranslation } from "@/components/ui/locale-provider";
import { prefetchSearchIndex } from "@/hooks/use-search-index";
import { humanizeProjectSlug } from "@/lib/project-slug";
import { cn } from "@/lib/utils";

type BreadcrumbSegment = { label: string; href?: string };

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { openOnboarding } = useOnboarding();
  const { collapsed, setCollapsed } = usePersistentSidebarCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    void prefetchSearchIndex();
  }, []);

  useEffect(() => {
    const onOnboardingAction = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (detail?.type === "open-mobile-sidebar") setMobileOpen(true);
      if (detail?.type === "close-mobile-sidebar") setMobileOpen(false);
    };
    window.addEventListener("synaro:onboarding-action", onOnboardingAction);
    return () => window.removeEventListener("synaro:onboarding-action", onOnboardingAction);
  }, []);

  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const path = router.pathname;
    const q = router.query;
    const titles: Record<string, string> = {
      "/dashboard": t("nav.dashboard"),
      "/projects": t("nav.projects"),
      "/agents": t("nav.agents"),
      "/logs": t("nav.logs"),
      "/settings": t("nav.settings"),
      "/settings/preferences": t("nav.preferences"),
      "/settings/profile": t("nav.profile"),
      "/settings/workspace": t("settings.workspace"),
      "/settings/security": t("settings.security"),
      "/settings/api-keys": t("nav.apiKeys"),
    };

    if (path === "/dashboard") {
      return [{ label: t("workspace.home") }];
    }

    if (path === "/projects") {
      return [{ label: t("workspace.home"), href: "/dashboard" }, { label: t("nav.projects") }];
    }

    if (path === "/agents") {
      return [{ label: t("workspace.home"), href: "/dashboard" }, { label: t("nav.agents") }];
    }

    if (path === "/agents/[agentId]/runs/[runId]") {
      return [
        { label: t("workspace.home"), href: "/dashboard" },
        { label: t("nav.agents"), href: "/agents" },
        { label: t("agents.runDetailTitle") },
      ];
    }

    if (path === "/logs") {
      return [{ label: t("workspace.home"), href: "/dashboard" }, { label: t("nav.logs") }];
    }

    if (path === "/projects/[projectSlug]/analytics") {
      const raw = q.projectSlug;
      const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
      return [
        { label: t("workspace.home"), href: "/dashboard" },
        { label: t("nav.projects"), href: "/projects" },
        { label: humanizeProjectSlug(slug), href: `/projects/${encodeURIComponent(slug)}` },
        { label: t("workspace.analytics") },
      ];
    }

    if (path === "/projects/[projectSlug]") {
      const raw = q.projectSlug;
      const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
      return [
        { label: t("workspace.home"), href: "/dashboard" },
        { label: t("nav.projects"), href: "/projects" },
        { label: humanizeProjectSlug(slug) },
      ];
    }

    if (path.startsWith("/projects/")) {
      const leaf = titles[path] ?? t("nav.projects");
      return [
        { label: t("workspace.home"), href: "/dashboard" },
        { label: t("nav.projects"), href: "/projects" },
        { label: leaf },
      ];
    }

    if (path === "/settings") {
      return [{ label: t("workspace.home"), href: "/dashboard" }, { label: t("nav.settings") }];
    }

    if (path.startsWith("/settings/")) {
      const leaf = titles[path] ?? t("nav.preferences");
      return [
        { label: t("workspace.home"), href: "/dashboard" },
        { label: t("nav.settings"), href: "/settings" },
        { label: leaf },
      ];
    }

    return [
      { label: t("workspace.home"), href: "/dashboard" },
      { label: titles[path] ?? t("workspace.page") },
    ];
  }, [router.pathname, router.query, t]);

  const isHome = breadcrumbs.length === 1 && breadcrumbs[0]?.label === t("workspace.home");

  const isProjectWorkspace =
    router.pathname === "/projects/[projectSlug]" ||
    router.pathname === "/projects/[projectSlug]/analytics";

  return (
    <div className="min-h-screen bg-background text-foreground [scrollbar-gutter:stable]">
      {/* Fixed to the viewport on lg+ so long pages do not scroll the rail away (sticky breaks under some overflow ancestors). */}
      <div className="fixed left-0 top-0 z-30 hidden h-dvh lg:block">
        <DashboardSidebar
          isCollapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </div>

      <div
        className={cn(
          "flex min-h-screen w-full min-w-0 flex-col transition-[padding-left] duration-300 ease-in-out motion-reduce:transition-none",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]",
        )}
      >
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
          <div className="flex h-14 min-w-0 items-center justify-between gap-2 px-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted lg:hidden"
                aria-label={t("workspace.openSidebar")}
              >
                <Menu className="size-4" />
              </button>
              <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap text-muted-foreground">
                  {isHome ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="flex items-center gap-2 font-medium text-foreground">
                        <HomeIcon className="size-4" />
                        <span>{t("workspace.home")}</span>
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  ) : (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          asChild
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <Link href="/dashboard">
                            <HomeIcon className="size-4" />
                            <span className="hidden sm:inline">{t("workspace.home")}</span>
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {breadcrumbs.slice(1).map((crumb, idx) => {
                        const tail = breadcrumbs.slice(1);
                        const isLast = idx === tail.length - 1;

                        return (
                          <Fragment key={`${crumb.label}-${idx}`}>
                            <BreadcrumbSeparator className="text-muted-foreground/60">
                              /
                            </BreadcrumbSeparator>
                            <BreadcrumbItem>
                              {!isLast && crumb.href ? (
                                <BreadcrumbLink
                                  asChild
                                  className="max-w-[8rem] truncate text-muted-foreground hover:text-foreground sm:max-w-none sm:overflow-visible sm:whitespace-normal"
                                >
                                  <Link href={crumb.href}>{crumb.label}</Link>
                                </BreadcrumbLink>
                              ) : (
                                <BreadcrumbPage className="max-w-[10rem] truncate font-medium text-foreground sm:max-w-none sm:overflow-visible sm:whitespace-normal">
                                  {crumb.label}
                                </BreadcrumbPage>
                              )}
                            </BreadcrumbItem>
                          </Fragment>
                        );
                      })}
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-2" data-onboarding="header-actions">
              <AiBackgroundTaskPill className="hidden md:inline-flex" />
              <AgentSpeechStopButton className="hidden md:inline-flex" />
              <AgentActiveRunsPill className="hidden md:inline-flex" />
              <DashboardNotifications />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 hover:bg-muted hover:text-foreground"
                    aria-label={t("workspace.help")}
                    title={t("workspace.help")}
                  >
                    <CircleHelp className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-52 rounded-xl border-border/70 bg-popover p-1 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
                >
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 rounded-lg"
                    onSelect={() => openOnboarding()}
                  >
                    <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                    {t("workspace.introExplainer")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                    <Link href="/documentation" className="flex items-center gap-2">
                      <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                      {t("nav.documentation")}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col px-3 sm:px-6",
            isProjectWorkspace ? "pt-1.5 pb-4 sm:pt-2 sm:pb-5" : "py-4 sm:py-6",
          )}
        >
          <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px]">
            <div className="h-full">
              <DashboardSidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onNavigate={() => setMobileOpen(false)}
                headerEnd={
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
                    aria-label={t("workspace.closeSidebar")}
                  >
                    <X className="size-4" />
                  </button>
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

