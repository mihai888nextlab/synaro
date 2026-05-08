"use client";

import { Fragment, ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { HomeIcon, Menu, X } from "lucide-react";

import { DashboardSidebar, usePersistentSidebarCollapse } from "@/components/ui/dashboard-sidebar";
import { DashboardNotifications } from "@/components/ui/dashboard-notifications";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/projects/sample-project-ui": "Sample project UI",
  "/logs": "Logs",
  "/settings": "Settings",
  "/settings/preferences": "Preferences",
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { collapsed, setCollapsed } = usePersistentSidebarCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathTitles = useMemo(() => {
    const path = router.pathname;
    if (path === "/dashboard") return ["Home"];
    if (path === "/projects" || path === "/logs") return ["Home", titles[path] ?? "Dashboard"];
    if (path.startsWith("/projects/")) {
      const leaf = titles[path] ?? "Project";
      return ["Home", "Projects", leaf];
    }
    if (path === "/settings") return ["Home", "Settings"];
    if (path.startsWith("/settings/")) {
      const leaf = titles[path] ?? "Preferences";
      return ["Home", "Settings", leaf];
    }
    return ["Home", titles[path] ?? "Dashboard"];
  }, [router.pathname]);
  const isHome = router.pathname === "/dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <DashboardSidebar
            isCollapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted lg:hidden"
                  aria-label="Open sidebar"
                >
                  <Menu className="size-4" />
                </button>
                <Breadcrumb>
                  <BreadcrumbList className="text-muted-foreground">
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
                        {pathTitles.slice(1).map((crumb, idx) => {
                          const isLast = idx === pathTitles.slice(1).length - 1;
                          const href =
                            crumb === "Settings"
                              ? "/settings"
                              : crumb === "Preferences"
                                ? "/settings/preferences"
                                : undefined;

                          return (
                            <Fragment key={`${crumb}-${idx}`}>
                              <BreadcrumbSeparator className="text-muted-foreground/60">
                                /
                              </BreadcrumbSeparator>
                              <BreadcrumbItem>
                                {isLast || !href ? (
                                  <BreadcrumbPage className="font-medium text-foreground">
                                    {crumb}
                                  </BreadcrumbPage>
                                ) : (
                                  <BreadcrumbLink
                                    asChild
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Link href={href}>{crumb}</Link>
                                  </BreadcrumbLink>
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

              <div className="flex items-center gap-2">
                <DashboardNotifications />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
            <div className="w-full">{children}</div>
          </main>
        </div>
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

