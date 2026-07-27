"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Folder,
  ScrollText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User,
  Bot,
  ChevronDown,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { SynaroLogo } from "@/components/ui/synaro-logo";
import { useTranslation } from "@/components/ui/locale-provider";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import type { Agent } from "@/lib/agents/agent-types";
import { cn } from "@/lib/utils";

type NavItem = {
  id: "dashboard" | "projects" | "agents" | "logs";
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  expandable?: "projects" | "agents";
};

const navItems: NavItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "projects", labelKey: "nav.projects", href: "/projects", icon: Folder, expandable: "projects" },
  { id: "agents", labelKey: "nav.agents", href: "/agents", icon: Bot, expandable: "agents" },
  { id: "logs", labelKey: "nav.logs", href: "/logs", icon: ScrollText },
];

const PREVIEW_LIMIT = 4;

type SidebarLink = { id: string; label: string; href: string };

function isActiveRoute(current: string, href: string) {
  if (href === "/dashboard") return current === "/dashboard";
  if (href === "/projects" || href.startsWith("/projects/")) {
    return current === "/projects" || current.startsWith("/projects/");
  }
  if (href.startsWith("/agents")) {
    return current === "/agents" || current.startsWith("/agents/");
  }
  return current === href || current.startsWith(`${href}/`);
}

function sortAgentsByRecent(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt ?? a.createdAt) || 0;
    const bTime = Date.parse(b.updatedAt ?? b.createdAt) || 0;
    return bTime - aTime;
  });
}

function useSidebarPreviewList(kind: "projects" | "agents") {
  const [items, setItems] = useState<SidebarLink[] | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        if (kind === "projects") {
          const res = await fetch("/api/projects", { cache: "no-store" });
          if (!res.ok) throw new Error("failed");
          const data = (await res.json()) as { projects?: SynaroProjectCardModel[] };
          if (cancelled) return;
          const projects = (data.projects ?? []).slice(0, PREVIEW_LIMIT);
          setItems(
            projects.map((p) => ({
              id: p.id,
              label: p.title,
              href: `/projects/${encodeURIComponent(p.slug)}`,
            })),
          );
        } else {
          const res = await fetch("/api/agents", { cache: "no-store" });
          if (!res.ok) throw new Error("failed");
          const agents = sortAgentsByRecent((await res.json()) as Agent[]).slice(0, PREVIEW_LIMIT);
          if (cancelled) return;
          setItems(
            agents.map((a) => ({
              id: a.id,
              label: a.name,
              href: `/agents?run=${encodeURIComponent(a.id)}`,
            })),
          );
        }
        fetchedRef.current = true;
      } catch {
        if (!cancelled) setItems([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { items };
}

function SidebarExpandableNavItem({
  item,
  active,
  isCollapsed,
  pathname,
  asPath,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  isCollapsed: boolean;
  pathname: string;
  asPath: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const kind = item.expandable!;
  const { items } = useSidebarPreviewList(kind);
  const listId = `sidebar-${kind}-preview`;
  const showList = open && !isCollapsed;

  const expandLabel =
    kind === "projects"
      ? open
        ? t("workspace.collapseProjects")
        : t("workspace.expandProjects")
      : open
        ? t("workspace.collapseAgents")
        : t("workspace.expandAgents");

  const emptyLabel =
    kind === "projects" ? t("workspace.noProjectsYet") : t("workspace.noAgentsYet");

  if (isCollapsed) {
    return (
      <li className="flex justify-center">
        <Link
          href={item.href}
          onClick={onNavigate}
          data-onboarding={kind === "projects" ? "nav-projects" : "nav-agents"}
          className={cn(
            "group flex h-10 w-10 items-center justify-center rounded-xl text-sm transition",
            active
              ? "border border-border/70 bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.icon className="size-4 text-muted-foreground transition group-hover:text-foreground" />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div
        className={cn(
          "flex items-center rounded-xl text-sm transition",
          active
            ? "border border-border/70 bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          data-onboarding={kind === "projects" ? "nav-projects" : "nav-agents"}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2"
        >
          <item.icon className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
          <span className="truncate font-medium">{t(item.labelKey)}</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={expandLabel}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {showList ? (
        <ul id={listId} className="mt-0.5 ml-3 space-y-0.5 border-l border-border/50 py-1 pl-2">
          {items === null ? null : items.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</li>
          ) : (
            items.map((link) => {
              const subActive =
                kind === "projects"
                  ? asPath === link.href || asPath.startsWith(`${link.href}/`) || pathname === link.href
                  : asPath.includes(`run=${encodeURIComponent(link.id)}`) ||
                    asPath.includes(`highlight=${encodeURIComponent(link.id)}`);
              return (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={cn(
                      "block truncate rounded-lg px-2 py-1.5 text-xs transition",
                      subActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                    title={link.label}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </li>
  );
}

export function DashboardSidebar({
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  headerEnd,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  /** Optional trailing control in the brand row (e.g. mobile close). */
  headerEnd?: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
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
            "flex h-14 items-center justify-between gap-2",
            headerEnd ? "pr-2" : "",
          ].join(" ")}
        >
          <Link
            href="/dashboard"
            className={[
              "ml-0 flex min-w-0 flex-1 items-center gap-0",
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
          {headerEnd ? <div className="shrink-0">{headerEnd}</div> : null}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className={[
            "absolute right-[-14px] top-1/2 hidden -translate-y-1/2 items-center justify-center",
            "size-7 rounded-full border border-border/70 bg-card text-muted-foreground shadow-[0_10px_30px_rgba(0,0,0,0.28)]",
            "transition hover:bg-muted hover:text-foreground lg:inline-flex",
          ].join(" ")}
          aria-label={isCollapsed ? t("workspace.expandSidebar") : t("workspace.collapseSidebar")}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>

        <nav className="px-2 py-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActiveRoute(activePath, item.href);
              if (item.expandable) {
                return (
                  <SidebarExpandableNavItem
                    key={item.id}
                    item={item}
                    active={active}
                    isCollapsed={isCollapsed}
                    pathname={activePath}
                    asPath={router.asPath}
                    onNavigate={onNavigate}
                  />
                );
              }

              return (
                <li key={item.id} className={isCollapsed ? "flex justify-center" : ""}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-onboarding={item.id === "dashboard" ? "nav-dashboard" : undefined}
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
                      {t(item.labelKey)}
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
                    <p className="truncate text-sm font-medium text-foreground">{t("common.loading")}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.account")}</p>
                  </>
                ) : status === "authenticated" ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">{email}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.account")}</p>
                  </>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">{t("nav.notSignedIn")}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.account")}</p>
                  </>
                )}
              </div>
            </button>

            {menuOpen && status !== "loading" && (
              <div
                role="menu"
                className={cn(
                  "absolute bottom-[calc(100%+8px)] left-0 z-50 rounded-xl border border-border/70 bg-popover p-1 shadow-[0_20px_60px_rgba(0,0,0,0.28)]",
                  isCollapsed
                    ? "min-w-[220px] w-max max-w-[min(280px,calc(100vw-2rem))]"
                    : "w-full",
                )}
              >
                {status === "authenticated" ? (
                  <>
                    <Link
                      href="/settings"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate?.();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      role="menuitem"
                    >
                      <Settings className="size-4 shrink-0 text-muted-foreground" />
                      {t("nav.settings")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      role="menuitem"
                    >
                      <LogOut className="size-4 shrink-0 text-muted-foreground" />
                      {t("nav.signOut")}
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
