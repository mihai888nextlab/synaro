"use client";

import { Fragment, ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { CircleHelp, HomeIcon, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardSidebar, usePersistentSidebarCollapse } from "@/components/ui/dashboard-sidebar";
import { DashboardNotifications } from "@/components/ui/dashboard-notifications";
import { AiBackgroundTaskPill } from "@/components/ui/ai-background-task";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useOnboarding } from "@/components/ui/onboarding";
import { humanizeProjectSlug } from "@/lib/project-slug";
import { cn } from "@/lib/utils";

type BreadcrumbSegment = { label: string; href?: string };

/** Static dashboard route titles for breadcrumbs (dynamic project routes resolved separately). */
const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/logs": "Logs",
  "/settings": "Settings",
  "/settings/preferences": "Preferences",
  "/settings/profile": "Profile",
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { openOnboarding } = useOnboarding();
  const { collapsed, setCollapsed } = usePersistentSidebarCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);

  const breadcrumbs = useMemo((): BreadcrumbSegment[] => {
    const path = router.pathname;
    const q = router.query;

    if (path === "/dashboard") {
      return [{ label: "Home" }];
    }

    if (path === "/projects") {
      return [{ label: "Home", href: "/dashboard" }, { label: "Projects" }];
    }

    if (path === "/logs") {
      return [{ label: "Home", href: "/dashboard" }, { label: "Logs" }];
    }

    if (path === "/projects/[projectSlug]/analytics") {
      const raw = q.projectSlug;
      const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
      return [
        { label: "Home", href: "/dashboard" },
        { label: "Projects", href: "/projects" },
        { label: humanizeProjectSlug(slug), href: `/projects/${encodeURIComponent(slug)}` },
        { label: "Analytics" },
      ];
    }

    if (path === "/projects/[projectSlug]") {
      const raw = q.projectSlug;
      const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
      return [
        { label: "Home", href: "/dashboard" },
        { label: "Projects", href: "/projects" },
        { label: humanizeProjectSlug(slug) },
      ];
    }

    if (path.startsWith("/projects/")) {
      const leaf = titles[path] ?? "Project";
      return [{ label: "Home", href: "/dashboard" }, { label: "Projects", href: "/projects" }, { label: leaf }];
    }

    if (path === "/settings") {
      return [{ label: "Home", href: "/dashboard" }, { label: "Settings" }];
    }

    if (path.startsWith("/settings/")) {
      const leaf = titles[path] ?? "Preferences";
      return [
        { label: "Home", href: "/dashboard" },
        { label: "Settings", href: "/settings" },
        { label: leaf },
      ];
    }

    return [{ label: "Home", href: "/dashboard" }, { label: titles[path] ?? "Page" }];
  }, [router.pathname, router.query]);

  const isHome = breadcrumbs.length === 1 && breadcrumbs[0]?.label === "Home";

  const isProjectWorkspace =
    router.pathname === "/projects/[projectSlug]" ||
    router.pathname === "/projects/[projectSlug]/analytics";

  return (
    <div className="min-h-screen bg-background text-foreground">
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
                aria-label="Open sidebar"
              >
                <Menu className="size-4" />
              </button>
              <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap text-muted-foreground">
                  {isHome ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="flex items-center gap-2 font-medium text-foreground">
                        <HomeIcon className="size-4" />
                        <span>Home</span>
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
                            <span className="hidden sm:inline">Home</span>
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
              <DashboardNotifications />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 hover:bg-muted hover:text-foreground"
                aria-label="Open onboarding tour"
                title="Help & onboarding"
                onClick={() => openOnboarding()}
              >
                <CircleHelp className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main
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
              <div className="absolute right-3 top-3 z-10">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 bg-black/60 text-zinc-200 backdrop-blur transition hover:bg-white/10"
                  aria-label="Close sidebar"
                >
                  <X className="size-4" />
                </button>
              </div>
              <DashboardSidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

