"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Folder,
  ScrollText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User,
  CircleUser,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { SynaroLogo } from "@/components/ui/synaro-logo";
import {
  getProjectsNavHref,
  readLastProjectsPath,
  writeLastProjectsPath,
} from "@/lib/dashboard-workflow-storage";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Logs", href: "/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActiveRoute(current: string, href: string) {
  if (href === "/dashboard") return current === "/dashboard";
  if (href === "/projects" || href.startsWith("/projects/")) {
    return current === "/projects" || current.startsWith("/projects/");
  }
  return current === href || current.startsWith(`${href}/`);
}

export function DashboardSidebar({
  isCollapsed,
  onToggleCollapse,
  onNavigate,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { data, status } = useSession();
  const email = data?.user?.email ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const activePath = router.pathname;
  const [projectsHref, setProjectsHref] = useState("/projects");

  useEffect(() => {
    setProjectsHref(getProjectsNavHref());
  }, []);

  useEffect(() => {
    writeLastProjectsPath(router.asPath);
    const href = readLastProjectsPath();
    if (href) setProjectsHref(href);
  }, [router.asPath]);

  const items = useMemo(
    () =>
      navItems.map((item) =>
        item.href === "/projects" ? { ...item, href: projectsHref } : item,
      ),
    [projectsHref],
  );

  return (
    <aside
      data-onboarding="sidebar"
      className={[
        "relative",
        "h-full border-r border-border/70 bg-background/75 backdrop-blur-xl",
        "transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
        isCollapsed ? "w-[72px]" : "w-[260px]",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div
          className={[
            "flex h-14 items-center justify-between",
          ].join(" ")}
        >
          <Link
            href="/dashboard"
            className={[
              "ml-0 flex w-full items-center gap-0",
              isCollapsed ? "justify-center" : "justify-start",
            ].join(" ")}
          >
            <SynaroLogo className="h-16 w-16 shrink-0 text-foreground" />
            <span
              className={[
                "whitespace-nowrap text-lg font-semibold tracking-tight text-foreground",
                isCollapsed ? "" : "-ml-3",
                "overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out motion-reduce:transition-none",
                isCollapsed
                  ? "max-w-0 -translate-x-1 opacity-0"
                  : "max-w-[140px] translate-x-0 opacity-100",
              ].join(" ")}
            >
              Synaro
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className={[
            "absolute right-[-14px] top-1/2 hidden -translate-y-1/2 items-center justify-center",
            "size-7 rounded-full border border-border/70 bg-card text-muted-foreground shadow-[0_10px_30px_rgba(0,0,0,0.28)]",
            "transition hover:bg-muted hover:text-foreground lg:inline-flex",
          ].join(" ")}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>

        <nav className="px-2 py-2">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActiveRoute(activePath, item.href);
              return (
                <li key={item.href} className={isCollapsed ? "flex justify-center" : ""}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={[
                      "group flex items-center rounded-xl text-sm transition",
                      isCollapsed
                        ? "h-10 w-10 justify-center gap-0 px-0"
                        : "gap-3 px-3 py-2",
                      active
                        ? "border border-border/70 bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <item.icon className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                    <span
                      className={[
                        "font-medium",
                        "overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out motion-reduce:transition-none",
                        isCollapsed
                          ? "max-w-0 -translate-x-1 opacity-0"
                          : "max-w-[180px] translate-x-0 opacity-100",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto p-2">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "flex items-center rounded-xl border bg-card/70 text-left transition hover:bg-muted",
                isCollapsed && menuOpen
                  ? "border-primary/50 ring-2 ring-primary/25"
                  : "border-border/70",
                isCollapsed
                  ? "mx-auto h-10 w-10 justify-center gap-0 px-0"
                  : "w-full gap-3 px-3 py-2",
              )}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                <User className="size-4" />
              </div>
              <div
                className={[
                  "min-w-0 flex-1",
                  "overflow-hidden transition-[opacity,max-width,transform] duration-300 ease-in-out motion-reduce:transition-none",
                  isCollapsed
                    ? "max-w-0 -translate-x-1 opacity-0"
                    : "max-w-[220px] translate-x-0 opacity-100",
                ].join(" ")}
              >
                {status === "loading" ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">Loading…</p>
                    <p className="text-xs text-muted-foreground/70">Account</p>
                  </>
                ) : status === "authenticated" ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">{email}</p>
                    <p className="text-xs text-muted-foreground/70">Account</p>
                  </>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">Not signed in</p>
                    <p className="text-xs text-muted-foreground/70">Account</p>
                  </>
                )}
              </div>
            </button>

            {menuOpen && status !== "loading" && (
              <div
                role="menu"
                className={cn(
                  "absolute bottom-[calc(100%+8px)] left-0 z-50 rounded-xl border border-border/70 bg-popover p-1 shadow-[0_20px_60px_rgba(0,0,0,0.28)]",
                  /* Same placement as expanded; when collapsed the rail is narrow, so cap width so labels stay readable. */
                  isCollapsed
                    ? "min-w-[220px] w-max max-w-[min(280px,calc(100vw-2rem))]"
                    : "w-full",
                )}
              >
                {status === "authenticated" ? (
                  <>
                    <Link
                      href="/settings/profile"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate?.();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      role="menuitem"
                    >
                      <CircleUser className="size-4 shrink-0 text-muted-foreground" />
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => void signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      role="menuitem"
                    >
                      <LogOut className="size-4 shrink-0 text-muted-foreground" />
                      Log out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate?.();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    role="menuitem"
                  >
                    <LogOut className="size-4 shrink-0 text-muted-foreground" />
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function usePersistentSidebarCollapse(key = "synaro.sidebar.collapsed") {
  // Important: keep the first render deterministic for SSR to avoid hydration mismatches.
  // We apply the persisted value right after hydration.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const next = window.localStorage.getItem(key) === "true";
      // Schedule outside the effect body to satisfy eslint rules and avoid cascading renders.
      queueMicrotask(() => setCollapsed(next));
    } catch {
      // ignore
    }
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed, key]);

  return { collapsed, setCollapsed };
}

