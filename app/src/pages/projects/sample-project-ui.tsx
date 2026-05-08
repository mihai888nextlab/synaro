import type { GetServerSideProps } from "next";
import * as React from "react";
import { FileIcon, FolderIcon, FolderOpenIcon, MessageSquareText, FolderTree } from "lucide-react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { requireAuth } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { Input } from "@/components/ui/input";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree";

type TabKey = "tree" | "chat";

interface Item {
  name: string;
  children?: string[];
}

const items: Record<string, Item> = {
  root: { name: "synaro", children: ["app", "packages", "docs", "config"] },

  // App (Next.js)
  app: { name: "app", children: ["src", "public", "prisma", "package-json", "next-config"] },
  "package-json": { name: "package.json" },
  "next-config": { name: "next.config.ts" },
  public: { name: "public", children: ["favicon", "og"] },
  favicon: { name: "favicon.ico" },
  og: { name: "og.png" },
  prisma: { name: "prisma", children: ["schema", "seed"] },
  schema: { name: "schema.prisma" },
  seed: { name: "seed.ts" },

  // src
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

  // Monorepo-ish placeholders
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

function TreePanel() {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>("schema");

  const tree = useTree<Item>({
    initialState: {
      expandedItems: ["engineering", "frontend", "design-system"],
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Project files</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Example tree UI for the Projects page.
          </p>
        </div>
        <div className="w-[240px] max-w-[50vw]">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-9"
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[360px_1fr]">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Explorer</p>
            <p className="text-xs text-muted-foreground">{visibleItems.length} items</p>
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

        <div className="min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
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
              <span className="rounded-full border border-border/70 bg-muted px-3 py-1 text-xs text-muted-foreground">
                Placeholder
              </span>
            </div>
          </div>

          <div className="grid h-full grid-rows-[auto_1fr] gap-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {["Commits", "Last build", "Open PRs"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/70 bg-card/70 p-3"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-2 h-6 w-16 rounded-lg bg-muted" />
                </div>
              ))}
            </div>

            <div className="min-h-0 overflow-auto rounded-2xl border border-border/70 bg-card/70 p-4">
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

export default function SampleProjectUIPage() {
  const [tab, setTab] = React.useState<TabKey>("tree");

  return (
    <div className="relative">
      <PageBackgroundPattern variant="section" className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Projects</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Sample project UI
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("tree")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                tab === "tree"
                  ? "border-border bg-muted text-foreground"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <FolderTree className="size-4" />
              File tree
            </button>
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                tab === "chat"
                  ? "border-border bg-muted text-foreground"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <MessageSquareText className="size-4" />
              AI chat
            </button>
          </div>
        </div>

        <div className="mt-6 min-h-[640px]">
          {tab === "tree" ? (
            <TreePanel />
          ) : (
            <div className="flex min-h-[640px] items-center justify-center">
              <AnimatedAIChat className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

