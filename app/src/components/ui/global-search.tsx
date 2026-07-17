"use client";

import * as React from "react";
import { useRouter } from "next/router";
import {
  Bot,
  CircleHelp,
  Command as CommandIcon,
  Folder,
  FolderPlus,
  History,
  KeyRound,
  LayoutDashboard,
  Plus,
  ScrollText,
  SearchIcon,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useTranslation } from "@/components/ui/locale-provider";
import { formatLogTimestamp } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type SearchEntryDef = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  groupKey: string;
  groupOrder: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  keywordsKey?: string;
};

type ResolvedSearchEntry = {
  id: string;
  title: string;
  description: string;
  group: string;
  groupOrder: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  keywords?: string[];
  ariaLabel?: string;
};

const GROUP_ORDER = {
  navigation: 0,
  quickActions: 1,
  projects: 2,
  agents: 3,
  activityLogs: 4,
  agentRuns: 5,
} as const;

const navigationEntryDefs: SearchEntryDef[] = [
  {
    id: "dashboard",
    titleKey: "search.dashboardTitle",
    descriptionKey: "search.dashboardDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/dashboard",
    icon: LayoutDashboard,
    keywordsKey: "search.keywords.dashboard",
  },
  {
    id: "projects",
    titleKey: "search.projectsTitle",
    descriptionKey: "search.projectsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/projects",
    icon: Folder,
    keywordsKey: "search.keywords.projects",
  },
  {
    id: "logs",
    titleKey: "search.logsTitle",
    descriptionKey: "search.logsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/logs",
    icon: ScrollText,
    keywordsKey: "search.keywords.logs",
  },
  {
    id: "settings",
    titleKey: "search.settingsTitle",
    descriptionKey: "search.settingsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings",
    icon: Settings,
    keywordsKey: "search.keywords.settings",
  },
  {
    id: "profile",
    titleKey: "search.profileTitle",
    descriptionKey: "search.profileDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings/profile",
    icon: UserRound,
    keywordsKey: "search.keywords.profile",
  },
  {
    id: "preferences",
    titleKey: "search.preferencesTitle",
    descriptionKey: "search.preferencesDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings/preferences",
    icon: Sparkles,
    keywordsKey: "search.keywords.preferences",
  },
  {
    id: "workspace-settings",
    titleKey: "search.workspaceSettingsTitle",
    descriptionKey: "search.workspaceSettingsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings/workspace",
    icon: Settings,
    keywordsKey: "search.keywords.workspaceSettings",
  },
  {
    id: "security-settings",
    titleKey: "search.securitySettingsTitle",
    descriptionKey: "search.securitySettingsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings/security",
    icon: Settings,
    keywordsKey: "search.keywords.securitySettings",
  },
  {
    id: "api-keys",
    titleKey: "search.apiKeysTitle",
    descriptionKey: "search.apiKeysDescription",
    groupKey: "search.groupNavigation",
    groupOrder: GROUP_ORDER.navigation,
    href: "/settings/api-keys",
    icon: KeyRound,
    keywordsKey: "search.keywords.apiKeys",
  },
];

const quickActionEntryDefs: SearchEntryDef[] = [
  {
    id: "action-create-project",
    titleKey: "search.createProjectTitle",
    descriptionKey: "search.createProjectDescription",
    groupKey: "search.groupQuickActions",
    groupOrder: GROUP_ORDER.quickActions,
    href: "/projects?create=1",
    icon: FolderPlus,
    keywordsKey: "search.keywords.createProject",
  },
  {
    id: "action-new-agent",
    titleKey: "search.newAgentTitle",
    descriptionKey: "search.newAgentDescription",
    groupKey: "search.groupQuickActions",
    groupOrder: GROUP_ORDER.quickActions,
    href: "/agents?create=1",
    icon: Plus,
    keywordsKey: "search.keywords.newAgent",
  },
  {
    id: "action-open-api-keys",
    titleKey: "search.openApiKeysActionTitle",
    descriptionKey: "search.openApiKeysActionDescription",
    groupKey: "search.groupQuickActions",
    groupOrder: GROUP_ORDER.quickActions,
    href: "/settings/api-keys",
    icon: KeyRound,
    keywordsKey: "search.keywords.openApiKeys",
  },
  {
    id: "help",
    titleKey: "search.helpCenterTitle",
    descriptionKey: "search.helpCenterDescription",
    groupKey: "search.groupQuickActions",
    groupOrder: GROUP_ORDER.quickActions,
    icon: CircleHelp,
    keywordsKey: "search.keywords.help",
  },
];

const staticEntryDefs = [...navigationEntryDefs, ...quickActionEntryDefs];

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function entrySearchValue(entry: ResolvedSearchEntry): string {
  return [entry.title, entry.description, entry.group, ...(entry.keywords ?? [])].join(" ");
}

function runStatusLabel(status: string, t: (key: string) => string): string {
  const key = `search.runStatus${status}`;
  const translated = t(key);
  return translated !== key ? translated : status;
}

function formatSearchTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatLogTimestamp(date);
}

function shortRunId(runId: string): string {
  const trimmed = runId.trim();
  if (trimmed.length <= 8) return trimmed;
  return trimmed.slice(-8);
}

function resolveStaticEntries(
  defs: SearchEntryDef[],
  t: (key: string, options?: Record<string, string | number>) => string,
): ResolvedSearchEntry[] {
  return defs.map((def) => {
    const title = t(def.titleKey);
    return {
      id: def.id,
      title,
      description: t(def.descriptionKey),
      group: t(def.groupKey),
      groupOrder: def.groupOrder,
      icon: def.icon,
      href: def.href,
      keywords: def.keywordsKey ? parseKeywords(t(def.keywordsKey)) : undefined,
      ariaLabel: t("search.goTo", { title }),
    };
  });
}

export function GlobalSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: searchIndex } = useSearchIndex();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo((): ResolvedSearchEntry[] => {
    const staticEntries = resolveStaticEntries(staticEntryDefs, t);

    if (!searchIndex) {
      return staticEntries;
    }

    // If projects/agents fail to load from upstream but we *do* have activity logs / runs,
    // synthesize minimal entries so search results still feel complete.
    const projectBySlug = new Map<string, { name: string }>();
    for (const p of searchIndex.projects) {
      projectBySlug.set(p.slug, { name: p.name });
    }
    for (const log of searchIndex.activityLogs) {
      const href = log.href ?? "";
      const m = href.match(/^\/projects\/([^/?#]+)/);
      if (!m) continue;
      const slugEnc = m[1];
      try {
        const slug = decodeURIComponent(slugEnc);
        if (!slug) continue;
        // For project-backed activity rows, `entityName` is the project name.
        if (!projectBySlug.has(slug)) projectBySlug.set(slug, { name: log.entityName });
      } catch {
        // ignore malformed encoded hrefs
      }
    }

    const projectEntries: ResolvedSearchEntry[] = Array.from(projectBySlug.entries()).map(
      ([slug, { name }]) => ({
        id: `project-${slug}`,
        title: name,
        description: t("search.projectFallbackDescription"),
        group: t("search.groupProjects"),
        groupOrder: GROUP_ORDER.projects,
        icon: Folder,
        href: `/projects/${encodeURIComponent(slug)}`,
        keywords: [slug],
        ariaLabel: t("search.openProject", { name }),
      }),
    );

    const agentById = new Map<string, { name: string; description?: string }>();
    for (const a of searchIndex.agents) {
      agentById.set(a.id, { name: a.name, description: a.description });
    }
    for (const run of searchIndex.agentRuns) {
      if (!run.agentId) continue;
      if (!agentById.has(run.agentId)) agentById.set(run.agentId, { name: run.agentName });
    }

    const agentEntries: ResolvedSearchEntry[] = Array.from(agentById.entries()).map(
      ([agentId, { name, description }]) => ({
        id: `agent-${agentId}`,
        title: name,
        description: description || t("search.agentFallbackDescription"),
        group: t("search.groupAgents"),
        groupOrder: GROUP_ORDER.agents,
        icon: Bot,
        href: `/agents?highlight=${encodeURIComponent(agentId)}`,
        keywords: [agentId],
        ariaLabel: t("search.openAgent", { name }),
      }),
    );

    const activityLogEntries: ResolvedSearchEntry[] = searchIndex.activityLogs
      .filter((log) => log.href)
      .map((log) => {
        const statusLabel = runStatusLabel(log.status, t);
        const timeLabel = formatSearchTimestamp(log.occurredAt);
        const description = timeLabel
          ? `${log.entityName} · ${statusLabel} · ${timeLabel}`
          : `${log.entityName} · ${statusLabel}`;
        return {
          id: `activity-${log.id}`,
          title: log.action,
          description,
          group: t("search.groupActivityLogs"),
          groupOrder: GROUP_ORDER.activityLogs,
          icon: ScrollText,
          href: log.href ?? undefined,
          keywords: [log.entityName, log.status, statusLabel, timeLabel ?? ""].filter(Boolean),
          ariaLabel: t("search.openActivityLog", { action: log.action }),
        };
      });

    const agentRunEntries: ResolvedSearchEntry[] = searchIndex.agentRuns.map((run) => {
      const statusLabel = runStatusLabel(run.status, t);
      const timeLabel = formatSearchTimestamp(run.createdAt);
      const runSuffix = shortRunId(run.id);
      const description = timeLabel
        ? t("search.agentRunDescription", { status: statusLabel, time: timeLabel, id: runSuffix })
        : t("search.agentRunDescriptionNoTime", { status: statusLabel, id: runSuffix });
      return {
        id: `run-${run.id}`,
        title: run.agentName,
        description,
        group: t("search.groupAgentRuns"),
        groupOrder: GROUP_ORDER.agentRuns,
        icon: History,
        href: `/agents/${encodeURIComponent(run.agentId)}/runs/${encodeURIComponent(run.id)}`,
        keywords: [run.agentName, run.status, statusLabel, timeLabel ?? "", run.id, run.agentId, runSuffix],
        ariaLabel: t("search.openAgentRun", { name: run.agentName }),
      };
    });

    return [
      ...staticEntries,
      ...projectEntries,
      ...agentEntries,
      ...activityLogEntries,
      ...agentRunEntries,
    ];
  }, [searchIndex, t]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      setOpen(false);
      setQuery("");
    });
  }, [router.asPath]);

  const groupedEntries = React.useMemo(() => {
    const groups = new Map<string, { order: number; entries: ResolvedSearchEntry[] }>();

    for (const entry of entries) {
      const current = groups.get(entry.group) ?? { order: entry.groupOrder, entries: [] };
      current.entries.push(entry);
      groups.set(entry.group, current);
    }

    return Array.from(groups.entries())
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([group, { entries: groupEntries }]) => [group, groupEntries] as const);
  }, [entries]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }, []);

  const handleSelect = React.useCallback(
    (entry: ResolvedSearchEntry) => {
      handleOpenChange(false);
      if (entry.href && entry.href !== router.asPath) {
        void router.push(entry.href);
      }
    },
    [handleOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "top-auto bottom-3 w-[min(720px,calc(100vw-1rem))] translate-y-0 p-0 shadow-none",
          "sm:bottom-4 sm:max-w-none",
        )}
      >
        <DialogTitle className="sr-only">{t("search.title")}</DialogTitle>

        <Command
          className={cn(
            "overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg shadow-black/10 backdrop-blur-xl",
          )}
        >
          <CommandList className="max-h-[min(45vh,420px)] p-1.5">
            <CommandEmpty className="flex min-h-[120px] flex-col items-center justify-center gap-1 py-8">
              <p className="text-sm text-muted-foreground">{t("search.noResults")}</p>
              <p className="text-xs text-muted-foreground/70">{t("search.noResultsHint")}</p>
            </CommandEmpty>

            {groupedEntries.map(([group, groupEntries]) => (
              <CommandGroup key={group} heading={group}>
                {groupEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={entrySearchValue(entry)}
                    onSelect={() => handleSelect(entry)}
                    className="gap-3 px-2 py-2"
                    aria-label={entry.ariaLabel}
                  >
                    <entry.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>

          <div className="border-t border-border/70 p-2">
            <div className="relative flex items-center">
              <SearchIcon
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground/70"
                aria-hidden
              />
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.placeholder")}
                aria-label={t("search.searchAriaLabel")}
                className={cn(
                  "h-9 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-14 text-sm shadow-sm shadow-black/5",
                  "placeholder:text-muted-foreground/70",
                  "focus-visible:border-input focus-visible:outline-none focus-visible:ring-0",
                )}
              />
              <kbd className="pointer-events-none absolute right-3 hidden items-center gap-0.5 text-[11px] font-medium text-muted-foreground/60 sm:inline-flex">
                <CommandIcon className="size-3" aria-hidden />
                K
              </kbd>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
