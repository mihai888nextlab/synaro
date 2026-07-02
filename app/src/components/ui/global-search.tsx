"use client";

import * as React from "react";
import { useRouter } from "next/router";
import {
  Bot,
  CircleHelp,
  Command as CommandIcon,
  Folder,
  KeyRound,
  LayoutDashboard,
  SearchIcon,
  ScrollText,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

type SearchEntryDef = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  groupKey: string;
  groupOrder: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  keywords?: string[];
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

const baseEntryDefs: SearchEntryDef[] = [
  {
    id: "dashboard",
    titleKey: "search.dashboardTitle",
    descriptionKey: "search.dashboardDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "overview"],
  },
  {
    id: "projects",
    titleKey: "search.projectsTitle",
    descriptionKey: "search.projectsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/projects",
    icon: Folder,
    keywords: ["repos", "files"],
  },
  {
    id: "logs",
    titleKey: "search.logsTitle",
    descriptionKey: "search.logsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/logs",
    icon: ScrollText,
    keywords: ["events", "history"],
  },
  {
    id: "settings",
    titleKey: "search.settingsTitle",
    descriptionKey: "search.settingsDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/settings",
    icon: Settings,
    keywords: ["config", "preferences"],
  },
  {
    id: "profile",
    titleKey: "search.profileTitle",
    descriptionKey: "search.profileDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/settings/profile",
    icon: UserRound,
    keywords: ["account", "user"],
  },
  {
    id: "preferences",
    titleKey: "search.preferencesTitle",
    descriptionKey: "search.preferencesDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/settings/preferences",
    icon: Sparkles,
    keywords: ["theme", "appearance"],
  },
  {
    id: "api-keys",
    titleKey: "search.apiKeysTitle",
    descriptionKey: "search.apiKeysDescription",
    groupKey: "search.groupNavigation",
    groupOrder: 0,
    href: "/settings/api-keys",
    icon: KeyRound,
    keywords: ["token", "bearer", "developer", "v1"],
  },
  {
    id: "help",
    titleKey: "search.helpCenterTitle",
    descriptionKey: "search.helpCenterDescription",
    groupKey: "search.groupQuickActions",
    groupOrder: 3,
    icon: CircleHelp,
    keywords: ["support", "docs"],
  },
];

function entrySearchValue(entry: ResolvedSearchEntry): string {
  return [entry.title, entry.description, entry.group, ...(entry.keywords ?? [])].join(" ");
}

export function GlobalSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: searchIndex } = useSearchIndex();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo((): ResolvedSearchEntry[] => {
    const staticEntries: ResolvedSearchEntry[] = baseEntryDefs.map((def) => {
      const title = t(def.titleKey);
      return {
        id: def.id,
        title,
        description: t(def.descriptionKey),
        group: t(def.groupKey),
        groupOrder: def.groupOrder,
        icon: def.icon,
        href: def.href,
        keywords: def.keywords,
        ariaLabel: t("search.goTo", { title }),
      };
    });

    if (!searchIndex) {
      return staticEntries;
    }

    const projectEntries: ResolvedSearchEntry[] = searchIndex.projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      description: project.description || t("search.projectFallbackDescription"),
      group: t("search.groupProjects"),
      groupOrder: 1,
      icon: Folder,
      href: `/projects/${encodeURIComponent(project.slug)}`,
      keywords: [project.slug, project.id],
      ariaLabel: t("search.openProject", { name: project.name }),
    }));

    const agentEntries: ResolvedSearchEntry[] = searchIndex.agents.map((agent) => ({
      id: `agent-${agent.id}`,
      title: agent.name,
      description: agent.description || t("search.agentFallbackDescription"),
      group: t("search.groupAgents"),
      groupOrder: 2,
      icon: Bot,
      href: `/agents?highlight=${encodeURIComponent(agent.id)}`,
      keywords: [agent.id],
      ariaLabel: t("search.openAgent", { name: agent.name }),
    }));

    return [...staticEntries, ...projectEntries, ...agentEntries];
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
