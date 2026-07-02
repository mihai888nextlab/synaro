"use client";

import * as React from "react";
import { useRouter } from "next/router";
import {
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
import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

type SearchEntry = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  groupKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  keywords?: string[];
};

const baseEntryDefs: SearchEntry[] = [
  {
    id: "dashboard",
    titleKey: "search.dashboardTitle",
    descriptionKey: "search.dashboardDescription",
    groupKey: "search.groupNavigation",
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "overview"],
  },
  {
    id: "projects",
    titleKey: "search.projectsTitle",
    descriptionKey: "search.projectsDescription",
    groupKey: "search.groupNavigation",
    href: "/projects",
    icon: Folder,
    keywords: ["repos", "files"],
  },
  {
    id: "logs",
    titleKey: "search.logsTitle",
    descriptionKey: "search.logsDescription",
    groupKey: "search.groupNavigation",
    href: "/logs",
    icon: ScrollText,
    keywords: ["events", "history"],
  },
  {
    id: "settings",
    titleKey: "search.settingsTitle",
    descriptionKey: "search.settingsDescription",
    groupKey: "search.groupNavigation",
    href: "/settings",
    icon: Settings,
    keywords: ["config", "preferences"],
  },
  {
    id: "profile",
    titleKey: "search.profileTitle",
    descriptionKey: "search.profileDescription",
    groupKey: "search.groupNavigation",
    href: "/settings/profile",
    icon: UserRound,
    keywords: ["account", "user"],
  },
  {
    id: "preferences",
    titleKey: "search.preferencesTitle",
    descriptionKey: "search.preferencesDescription",
    groupKey: "search.groupNavigation",
    href: "/settings/preferences",
    icon: Sparkles,
    keywords: ["theme", "appearance"],
  },
  {
    id: "api-keys",
    titleKey: "search.apiKeysTitle",
    descriptionKey: "search.apiKeysDescription",
    groupKey: "search.groupNavigation",
    href: "/settings/api-keys",
    icon: KeyRound,
    keywords: ["token", "bearer", "developer", "v1"],
  },
  {
    id: "help",
    titleKey: "search.helpCenterTitle",
    descriptionKey: "search.helpCenterDescription",
    groupKey: "search.groupQuickActions",
    icon: CircleHelp,
    keywords: ["support", "docs"],
  },
];

export function GlobalSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo(
    () =>
      baseEntryDefs.map((def) => ({
        ...def,
        title: t(def.titleKey),
        description: t(def.descriptionKey),
        group: t(def.groupKey),
      })),
    [t],
  );

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
    const groups = new Map<string, typeof entries>();

    for (const entry of entries) {
      const current = groups.get(entry.group) ?? [];
      current.push(entry);
      groups.set(entry.group, current);
    }

    return Array.from(groups.entries());
  }, [entries]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }, []);

  const handleSelect = React.useCallback(
    (entry: (typeof entries)[number]) => {
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

        <Command className="overflow-visible bg-transparent">
          <CommandList className="mb-3 max-h-[min(45vh,420px)] rounded-2xl border border-border/70 bg-card/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CommandEmpty className="flex min-h-[180px] flex-col items-center justify-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground">
                <SearchIcon className="size-4" />
              </div>
              <div className="flex flex-col gap-1 text-center">
                <p className="text-sm font-medium text-foreground">{t("search.noResults")}</p>
                <p className="text-xs text-muted-foreground">{t("search.noResultsHint")}</p>
              </div>
            </CommandEmpty>

            {groupedEntries.map(([group, groupEntries]) => (
              <CommandGroup key={group} heading={group}>
                {groupEntries.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={[entry.title, entry.description, entry.group, ...(entry.keywords ?? [])].join(" ")}
                    onSelect={() => handleSelect(entry)}
                    className="gap-3 px-3 py-3"
                  >
                    <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground">
                      <entry.icon className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>

          <div className="rounded-2xl border border-border/70 bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground">
                <SearchIcon className="size-4" />
              </div>
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.placeholder")}
                className="h-auto flex-1"
              />
              <div className="hidden items-center gap-1 rounded-lg border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground sm:flex">
                <CommandIcon className="size-3.5" />
                <span>K</span>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
