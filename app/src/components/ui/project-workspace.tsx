import * as React from "react";
import { FileIcon, FolderIcon, FolderOpenIcon, MessageSquareText, FolderTree } from "lucide-react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { Input } from "@/components/ui/input";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { ProjectIframePreview } from "@/components/ui/project-iframe-preview";
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree";
import { humanizeProjectSlug } from "@/lib/project-slug";
import { cn } from "@/lib/utils";

type TabKey = "tree" | "chat";

interface Item {
  name: string;
  children?: string[];
}

const items: Record<string, Item> = {
  root: { name: "synaro", children: ["app", "packages", "docs", "config"] },

  app: { name: "app", children: ["src", "public", "prisma", "package-json", "next-config"] },
  "package-json": { name: "package.json" },
  "next-config": { name: "next.config.ts" },
  public: { name: "public", children: ["favicon", "og"] },
  favicon: { name: "favicon.ico" },
  og: { name: "og.png" },
  prisma: { name: "prisma", children: ["schema", "seed"] },
  schema: { name: "schema.prisma" },
  seed: { name: "seed.ts" },

  src: { name: "src", children: ["pages", "components", "lib", "styles"] },
  pages: { name: "pages", children: ["dashboard-page", "projects-page", "api"] },
  "dashboard-page": { name: "dashboard.tsx" },
  "projects-page": { name: "projects.tsx" },
  api: { name: "api", children: ["auth", "hello"] },
  auth: { name: "auth", children: ["nextauth"] },
  nextauth: { name: "[...nextauth].ts" },
  hello: { name: "hello.ts" },

  components: { name: "components", children: ["ui", "marketing"] },
  ui: { name: "ui", children: ["dashboard-layout", "dashboard-sidebar", "tree-ui", "chat-ui"] },
  "dashboard-layout": { name: "dashboard-layout.tsx" },
  "dashboard-sidebar": { name: "dashboard-sidebar.tsx" },
  "tree-ui": { name: "tree.tsx" },
  "chat-ui": { name: "animated-ai-chat.tsx" },
  marketing: { name: "marketing", children: ["hero", "pricing"] },
  hero: { name: "hero.tsx" },
  pricing: { name: "pricing.tsx" },

  lib: { name: "lib", children: ["auth-redirect", "prisma-client", "utils"] },
  "auth-redirect": { name: "auth-redirect.ts" },
  "prisma-client": { name: "prisma.ts" },
  utils: { name: "utils.ts" },

  styles: { name: "styles", children: ["globals"] },
  globals: { name: "globals.css" },

  packages: { name: "packages", children: ["project-service", "shared"] },
  "project-service": { name: "project-service", children: ["dockerfile", "service-src"] },
  dockerfile: { name: "Dockerfile" },
  "service-src": { name: "src", children: ["main", "routes"] },
  main: { name: "main.ts" },
  routes: { name: "routes.ts" },
  shared: { name: "shared", children: ["types", "utils-shared"] },
  types: { name: "types.ts" },
  "utils-shared": { name: "utils.ts" },

  docs: { name: "docs", children: ["agents", "readme"] },
  agents: { name: "AGENTS.md" },
  readme: { name: "README.md" },

  config: { name: "config", children: ["eslint", "tailwind", "tsconfig"] },
  eslint: { name: "eslint.config.mjs" },
  tailwind: { name: "tailwind.config.ts" },
  tsconfig: { name: "tsconfig.json" },
};

const indent = 20;

export function TreePanel() {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>("schema");

  const tree = useTree<Item>({
    initialState: {
      expandedItems: ["root", "app", "src", "prisma"],
    },
    indent,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId].children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const visibleItems = React.useMemo(() => {
    const list = tree.getItems();
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) => it.getItemName().toLowerCase().includes(q));
  }, [tree, query]);

  const selectedItem = React.useMemo(() => {
    if (!selectedId) return null;
    return visibleItems.find((it) => it.getId() === selectedId) ?? null;
  }, [selectedId, visibleItems]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[360px_1fr] lg:gap-3">
        <div className="min-h-0 overflow-hidden rounded-2xl bg-background/40">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Explorer</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{visibleItems.length} items</p>
              <div className="w-[120px] sm:w-[140px]">
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="h-7 rounded-lg px-2 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-auto p-3">
            <Tree
              className="relative before:absolute before:inset-0 before:-ms-1 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
              indent={indent}
              tree={tree}
            >
              {visibleItems.map((item) => {
                const isSelected = selectedId === item.getId();
                return (
                  <TreeItem key={item.getId()} item={item}>
                    <TreeItemLabel
                      onClick={() => setSelectedId(item.getId())}
                      className={cn(
                        "cursor-pointer",
                        isSelected && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {item.isFolder() ? (
                          item.isExpanded() ? (
                            <FolderOpenIcon className="size-4 text-muted-foreground" />
                          ) : (
                            <FolderIcon className="size-4 text-muted-foreground" />
                          )
                        ) : (
                          <FileIcon className="size-4 text-muted-foreground" />
                        )}
                        {item.getItemName()}
                      </span>
                    </TreeItemLabel>
                  </TreeItem>
                );
              })}
            </Tree>
          </div>
        </div>

        <div className="min-h-0 overflow-hidden rounded-2xl bg-background/40">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {selectedItem ? selectedItem.getItemName() : "Select a file"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedItem
                  ? `Path: /${selectedItem.getItemName().toLowerCase().replaceAll(" ", "-")}`
                  : "Choose something in the explorer to preview details."}
              </p>
            </div>
            <div className="hidden sm:block">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                Placeholder
              </span>
            </div>
          </div>

          <div className="grid h-full grid-rows-[auto_1fr] gap-3 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {["Commits", "Last build", "Open PRs"].map((label) => (
                <div key={label} className="rounded-2xl bg-card/70 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-2 h-6 w-16 rounded-lg bg-muted" />
                </div>
              ))}
            </div>

            <div className="min-h-0 overflow-auto rounded-2xl bg-card/70 p-3">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 rounded-lg bg-muted" />
                <div className="h-4 w-2/3 rounded-lg bg-muted" />
                <div className="h-4 w-5/6 rounded-lg bg-muted" />
                <div className="h-4 w-1/2 rounded-lg bg-muted" />
                <div className="h-4 w-4/5 rounded-lg bg-muted" />
                <div className="h-4 w-2/5 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type ProjectWorkspaceProps = {
  /** Route segment from `/projects/[projectSlug]`; used for in-page context. */
  projectSlug?: string;
};

/**
 * Full-width project workspace (file tree, AI chat, iframe preview) — same layout as the former sample page.
 */
export function ProjectWorkspace({ projectSlug }: ProjectWorkspaceProps) {
  const [tab, setTab] = React.useState<TabKey>("tree");
  const projectLabel = projectSlug ? humanizeProjectSlug(projectSlug) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageBackgroundPattern variant="section" className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-0",
            "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]",
            "xl:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] xl:grid-rows-1",
          )}
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-background/40">
            <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={() => setTab("tree")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  tab === "tree"
                    ? "bg-muted text-foreground"
                    : "bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <FolderTree className="size-4" />
                File tree
              </button>
              <button
                type="button"
                onClick={() => setTab("chat")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  tab === "chat"
                    ? "bg-muted text-foreground"
                    : "bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <MessageSquareText className="size-4" />
                AI chat
              </button>
              {projectLabel ? (
                <span
                  className="ms-auto max-w-[min(100%,14rem)] truncate text-xs text-muted-foreground sm:max-w-xs"
                  title={projectLabel}
                >
                  {projectLabel}
                </span>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {tab === "tree" ? (
                <TreePanel />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                  <AnimatedAIChat className="w-full max-w-3xl" />
                </div>
              )}
            </div>
          </div>

          <ProjectIframePreview className="h-full min-h-[40vh] xl:min-h-0" title="Preview" />
        </div>
      </div>
    </div>
  );
}
