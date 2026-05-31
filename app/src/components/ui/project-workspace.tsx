import * as React from "react";
import {
  Download,
  ExternalLink,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2,
  MessageSquareText,
  FolderTree,
  PencilIcon,
  PlayIcon,
  Rocket,
  ScrollText,
  TerminalSquare,
  X,
} from "lucide-react";
import type { TreeState, Updater } from "@headless-tree/core";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { ProjectContainerTerminal } from "@/components/ui/project-container-terminal";
import { Input } from "@/components/ui/input";
import { ProjectIframePreview } from "@/components/ui/project-iframe-preview";
import { ProjectShareInvite } from "@/components/ui/project-share-invite";
import {
  SynaroProjectDockerPill,
  type SynaroProjectCardModel,
  type SynaroProjectEnvironmentStatus,
} from "@/components/ui/project-cards-grid";
import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree";
import {
  readProjectTab,
  readWorkspaceTreeExpanded,
  writeProjectTab,
  writeWorkspaceTreeExpanded,
  type ProjectWorkspaceTab,
} from "@/lib/dashboard-workflow-storage";
import { humanizeProjectSlug } from "@/lib/project-slug";
import {
  defaultExpandedWorkspaceFolderIds,
  filePathsToTreeItems,
  relativePathFromTreeItemId,
  type WorkspaceExplorerItem,
} from "@/lib/workspace-path-tree";
import type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";
import type { WorkspaceSelectionApiResponse } from "@/lib/workspace-selection-types";
import { cn } from "@/lib/utils";

type TabKey = ProjectWorkspaceTab;

const indent = 20;

/** Outer padding for the explorer grid (tree + detail) — reuse for the terminal tab shell. */
const workspaceExplorerTabPaddingClass = "px-3 pb-3 pt-0";

/** Explorer / terminal card: capped on small viewports, full column height from `lg` up. */
const workspaceExplorerPrimaryCardSizeClass =
  "min-h-[12rem] max-h-[min(58vh,32rem)] min-h-0 lg:min-h-0 lg:max-h-none lg:h-full";

function placeholderTreeItems(message: string): Record<string, WorkspaceExplorerItem> {
  const hint = "syn:status";
  return {
    root: { name: "repository", children: [hint] },
    [hint]: { name: message },
  };
}

type LiveExplorerTreeProps = {
  projectId?: string;
  /** When false, hide GitHub-only panels (Actions / PRs); uploads have no linked repo. */
  projectHasGitRemote: boolean;
  environmentStatus: SynaroProjectEnvironmentStatus;
  items: Record<string, WorkspaceExplorerItem>;
  truncated: boolean;
  loadState: "idle" | "loading" | "ready" | "hint";
  /** True while the File tree tab is visible — used to auto-expand the root folder on each visit. */
  treeTabActive: boolean;
};

function formatShortDate(iso: string): string {
  const s = iso.trim();
  if (s.length >= 10) return s.slice(0, 10);
  return s || "—";
}

function LiveExplorerTree({
  projectId,
  projectHasGitRemote,
  environmentStatus,
  items,
  truncated,
  loadState,
  treeTabActive,
}: LiveExplorerTreeProps) {
  /** Restore from localStorage on every mount (tab switches remount this tree via `treeKey`). */
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const initialHydratedRef = React.useRef(false);

  // Restore persisted expanded items after hydration (localStorage not available on server)
  React.useEffect(() => {
    if (!projectId) return;
    const saved = readWorkspaceTreeExpanded(projectId);
    if (saved && saved.length > 0) setExpandedItems(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const allowPersistExpandedRef = React.useRef(false);
  const prevProjectIdForExpandedRef = React.useRef<string | undefined>(undefined);

  /** Only reset when navigating to a different project — not on remount of the same project (same `projectId`). */
  React.useEffect(() => {
    if (!projectId) {
      prevProjectIdForExpandedRef.current = undefined;
      initialHydratedRef.current = false;
      allowPersistExpandedRef.current = false;
      setExpandedItems([]);
      return;
    }
    if (prevProjectIdForExpandedRef.current !== projectId) {
      const wasSet = prevProjectIdForExpandedRef.current !== undefined;
      prevProjectIdForExpandedRef.current = projectId;
      if (wasSet) {
        initialHydratedRef.current = false;
        allowPersistExpandedRef.current = false;
        setExpandedItems(readWorkspaceTreeExpanded(projectId) ?? []);
      }
    }
  }, [projectId]);

  React.useEffect(() => {
    if (!projectId) return;
    if (loadState !== "ready") return;
    const firstChild = items.root?.children?.[0];
    if (typeof firstChild === "string" && firstChild.startsWith("syn:")) return;

    const keys = new Set(Object.keys(items));
    if (!initialHydratedRef.current) {
      initialHydratedRef.current = true;
      setExpandedItems((prev) => {
        const filtered = prev.filter((id) => keys.has(id));
        const auto = treeTabActive ? defaultExpandedWorkspaceFolderIds(items) : [];
        return [...new Set([...filtered, ...auto])];
      });
      allowPersistExpandedRef.current = true;
      return;
    }
    setExpandedItems((prev) => {
      const next = prev.filter((id) => keys.has(id));
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [projectId, loadState, items, treeTabActive]);

  const prevTreeTabActiveRef = React.useRef(false);
  const expandMainFolderOnTreeTabRef = React.useRef(false);

  React.useEffect(() => {
    if (treeTabActive && !prevTreeTabActiveRef.current) {
      expandMainFolderOnTreeTabRef.current = true;
    }
    if (!treeTabActive) {
      expandMainFolderOnTreeTabRef.current = false;
    }
    prevTreeTabActiveRef.current = treeTabActive;
  }, [treeTabActive]);

  const handleTreeSetState = React.useCallback(
    (updaterOrValue: Updater<Partial<TreeState<WorkspaceExplorerItem>>>) => {
      const applyExpanded = (nextExpanded: string[]) => {
        setExpandedItems(nextExpanded);
        if (allowPersistExpandedRef.current && projectId) {
          writeWorkspaceTreeExpanded(projectId, nextExpanded);
        }
      };

      if (typeof updaterOrValue === "function") {
        setExpandedItems((prev) => {
          const partial = updaterOrValue({ expandedItems: prev, focusedItem: null });
          if (!Array.isArray(partial?.expandedItems)) return prev;
          if (allowPersistExpandedRef.current && projectId) {
            writeWorkspaceTreeExpanded(projectId, partial.expandedItems);
          }
          return partial.expandedItems;
        });
        return;
      }

      if (Array.isArray(updaterOrValue.expandedItems)) {
        applyExpanded(updaterOrValue.expandedItems);
      }
    },
    [projectId],
  );

  const tree = useTree<WorkspaceExplorerItem>({
    initialState: {
      expandedItems: [],
      focusedItem: null,
    },
    state: { expandedItems },
    setState: handleTreeSetState,
    indent,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => items[itemId] ?? { name: "…" },
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Do not memoize on `tree` alone: @headless-tree/react runs the first `rebuildTree()` in
  // `useEffect`, so `getItems()` is empty on the first paint then populated. A `useMemo` whose
  // deps do not change after that effect would keep returning the initial empty list forever.
  const q = query.trim().toLowerCase();
  const list = tree.getItems();

  /** Expand top-level project folder(s) after headless-tree has built visible rows (root itself is not listed). */
  React.useLayoutEffect(() => {
    if (!expandMainFolderOnTreeTabRef.current || !treeTabActive || loadState !== "ready") return;

    const expandIds = defaultExpandedWorkspaceFolderIds(items);
    if (expandIds.length === 0) return;
    if (list.length === 0) return;

    let anyTargetReady = false;
    for (const id of expandIds) {
      try {
        const inst = tree.getItemInstance(id);
        anyTargetReady = true;
        if (inst.isFolder() && !inst.isExpanded()) {
          inst.expand();
        }
      } catch {
        /* row not registered yet */
      }
    }
    if (!anyTargetReady) return;

    setExpandedItems((prev) => {
      const next = [...new Set([...prev, ...expandIds])];
      if (next.length === prev.length && expandIds.every((id) => prev.includes(id))) {
        return prev;
      }
      if (allowPersistExpandedRef.current && projectId) {
        writeWorkspaceTreeExpanded(projectId, next);
      }
      return next;
    });

    expandMainFolderOnTreeTabRef.current = false;
  }, [treeTabActive, loadState, items, list.length, tree, projectId]);

  const visibleItems = !q ? list : list.filter((it) => it.getItemName().toLowerCase().includes(q));

  const selectedItem = React.useMemo(() => {
    if (!selectedId) return null;
    return visibleItems.find((it) => it.getId() === selectedId) ?? null;
  }, [selectedId, visibleItems]);

  const selectedPath = selectedId ? relativePathFromTreeItemId(selectedId) : null;

  const [detail, setDetail] = React.useState<WorkspaceSelectionApiResponse | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!projectId || environmentStatus !== "RUNNING" || !selectedPath) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    if (!selectedId || selectedId === "root" || selectedId.startsWith("syn:")) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const pid = projectId;
    const relPath = selectedPath;

    const ac = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    async function run() {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(pid)}/workspace-selection?path=${encodeURIComponent(relPath)}`,
          { signal: ac.signal, cache: "no-store" },
        );
        const raw = await res.text();
        let data: WorkspaceSelectionApiResponse | { error?: string } = {};
        try {
          data = raw ? (JSON.parse(raw) as WorkspaceSelectionApiResponse & { error?: string }) : {};
        } catch {
          if (!ac.signal.aborted) setDetailError("Could not parse selection response.");
          return;
        }
        if (!res.ok) {
          const errJson = data as { error?: string };
          if (!ac.signal.aborted) {
            setDetailError(errJson.error ?? `Request failed (${res.status})`);
          }
          return;
        }
        if (!ac.signal.aborted) setDetail(data as WorkspaceSelectionApiResponse);
      } catch (e) {
        if (ac.signal.aborted) return;
        setDetailError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!ac.signal.aborted) setDetailLoading(false);
      }
    }

    void run();
    return () => ac.abort();
  }, [projectId, environmentStatus, selectedId, selectedPath]);

  const commitsToShow =
    detail?.github?.fileCommits && detail.github.fileCommits.length > 0
      ? detail.github.fileCommits.map((c) => ({
        label: c.shortSha,
        sub: `${formatShortDate(c.date)} · ${c.author}`,
        line: c.message,
        href: c.htmlUrl,
      }))
      : (detail?.gitLog ?? []).map((c) => ({
        label: c.shortSha,
        sub: `${formatShortDate(c.date)} · ${c.author}`,
        line: c.subject,
        href: null as string | null,
      }));

  const showSelectionPanel = Boolean(selectedPath);

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-3 lg:h-full lg:grid-rows-1 lg:gap-3",
        workspaceExplorerTabPaddingClass,
        showSelectionPanel
          ? "max-lg:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
          : "lg:grid-cols-1",
      )}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
          workspaceExplorerPrimaryCardSizeClass,
        )}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Project files
            {loadState === "loading" ? (
              <span className="ms-2 font-normal text-muted-foreground">· loading…</span>
            ) : null}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <p className="shrink-0 text-xs text-muted-foreground">{visibleItems.length} items</p>
            <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <Tree className="gap-0.5" indent={indent} tree={tree}>
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

      {showSelectionPanel ? (
        <div className="flex max-h-[min(52vh,28rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:max-h-none lg:flex-1">
          <div className="flex items-start justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {selectedItem ? selectedItem.getItemName() : selectedPath}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{selectedPath}</p>
            </div>
            <div className="shrink-0 max-sm:mt-0.5">
              {truncated ? (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-700 dark:text-amber-400">
                  List truncated
                </span>
              ) : (
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Read-only</span>
              )}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3 p-3 pt-0">
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                projectHasGitRemote ? "sm:grid-cols-3" : "sm:grid-cols-1",
              )}
            >
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Commits</p>
                {detailLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Loading…
                  </div>
                ) : detailError ? (
                  <p className="mt-2 text-xs text-destructive">{detailError}</p>
                ) : commitsToShow.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {projectHasGitRemote
                      ? "No commit history for this path yet."
                      : "No Git history — uploaded projects do not include a .git directory (only the files you imported)."}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-32 space-y-2 overflow-auto text-xs">
                    {commitsToShow.slice(0, 5).map((c, i) => (
                      <li key={`${c.label}-${i}`} className="leading-snug">
                        <span className="font-mono text-foreground">{c.label}</span>
                        {c.href ? (
                          <a
                            href={c.href}
                            target="_blank"
                            rel="noreferrer"
                            className="ms-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
                            aria-label="Open on GitHub"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                        <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">{c.sub}</span>
                        <span className="line-clamp-2 text-muted-foreground">{c.line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {projectHasGitRemote ? (
                <>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Last build</p>
                    {detailLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Loading…
                      </div>
                    ) : detail?.github?.lastWorkflowRun ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="font-medium text-foreground">{detail.github.lastWorkflowRun.name}</p>
                        <p className="text-muted-foreground">
                          {detail.github.lastWorkflowRun.status}
                          {detail.github.lastWorkflowRun.conclusion
                            ? ` · ${detail.github.lastWorkflowRun.conclusion}`
                            : ""}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {formatShortDate(detail.github.lastWorkflowRun.createdAt)}
                        </p>
                        <a
                          href={detail.github.lastWorkflowRun.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[0.65rem] text-primary hover:underline"
                        >
                          View run <ExternalLink className="size-3" />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {detail?.github === undefined && projectId
                          ? "Link GitHub in your account and set a GitHub clone URL on the project to see Actions runs."
                          : "No recent workflow run returned for this repository."}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Open PRs</p>
                    {detailLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Loading…
                      </div>
                    ) : detail?.github?.openPullRequests && detail.github.openPullRequests.length > 0 ? (
                      <ul className="mt-2 max-h-32 space-y-2 overflow-auto text-xs">
                        {detail.github.openPullRequests.map((pr) => (
                          <li key={pr.number}>
                            <a
                              href={pr.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-primary hover:underline"
                            >
                              #{pr.number}
                            </a>
                            <span className="ms-1 text-muted-foreground line-clamp-2">{pr.title}</span>
                            <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
                              Updated {formatShortDate(pr.updatedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {detail?.github === undefined && projectId
                          ? "Connect GitHub to list open pull requests for this repo."
                          : "No open PRs returned (or none open right now)."}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-3">
                  <p className="text-xs font-medium text-muted-foreground">GitHub Actions and pull requests</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Shown only for projects created from a GitHub repository URL. This project is a{" "}
                    <span className="font-medium text-foreground">folder upload</span> (no linked repo). Files still
                    live in the same container workspace as a Git import:{" "}
                    <code className="rounded bg-muted px-1 py-px text-[0.65rem]">/tmp/synaro-workspace/app</code>.
                  </p>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-muted/30 p-3">
              <p className="shrink-0 text-xs font-medium text-muted-foreground">Preview</p>
              {detailLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading file contents…
                </div>
              ) : detailError ? (
                <p className="mt-3 text-xs text-destructive">{detailError}</p>
              ) : detail?.kind === "directory" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  This path is a directory. Expand it in the tree or pick a file to see source preview.
                </p>
              ) : detail?.kind === "missing" || detail?.kind === "notfile" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  This path is not available as a regular file in the container workspace (missing or special file).
                </p>
              ) : detail?.kind === "file" && detail.content != null ? (
                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                  {detail.contentTruncated ? (
                    <p className="shrink-0 text-[0.65rem] text-amber-700 dark:text-amber-400">
                      Preview truncated — file exceeds the safe read limit in the container.
                    </p>
                  ) : null}
                  <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-[0.7rem] leading-relaxed text-foreground">
                    {detail.content}
                  </pre>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No preview available for this selection.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type TreePanelProps = {
  projectId?: string;
  projectHasGitRemote: boolean;
  environmentStatus: SynaroProjectEnvironmentStatus;
  treeRefreshKey: number;
  treeTabActive: boolean;
};

function TreePanel({
  projectId,
  projectHasGitRemote,
  environmentStatus,
  treeRefreshKey,
  treeTabActive,
}: TreePanelProps) {
  const [items, setItems] = React.useState<Record<string, WorkspaceExplorerItem>>(() =>
    placeholderTreeItems("Connect to a project to load the repository tree."),
  );
  const [truncated, setTruncated] = React.useState(false);
  const [treeKey, setTreeKey] = React.useState("initial");
  const [loadState, setLoadState] = React.useState<"idle" | "loading" | "ready" | "hint">("idle");
  const treeNonce = React.useRef(0);
  /** After first successful tree paint, refetches skip the full-tree loading placeholder (tab / Docker refresh). */
  const treeWasReadyRef = React.useRef(false);
  const prevProjectIdForTreeRef = React.useRef<string | undefined>(undefined);
  const bumpTreeKey = React.useCallback(() => {
    treeNonce.current += 1;
    setTreeKey(`tree-${treeNonce.current}`);
  }, []);

  React.useEffect(() => {
    if (!projectId) {
      treeWasReadyRef.current = false;
      prevProjectIdForTreeRef.current = undefined;
      setItems(placeholderTreeItems("Connect to a project to load the repository tree."));
      setLoadState("hint");
      bumpTreeKey();
      return;
    }

    if (prevProjectIdForTreeRef.current !== projectId) {
      treeWasReadyRef.current = false;
      prevProjectIdForTreeRef.current = projectId;
    }

    const pid = projectId;

    let cancelled = false;

    let pollTimer: number | null = null;
    function stopPoll() {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    async function load() {
      if (!cancelled && !treeWasReadyRef.current) {
        setItems(placeholderTreeItems("Loading file list…"));
        setLoadState("loading");
      }
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(pid)}/workspace-files`, {
          cache: "no-store",
        });
        const raw = await res.text();
        let data: WorkspaceFilesResponse | { error?: string } = {};
        try {
          data = raw ? (JSON.parse(raw) as WorkspaceFilesResponse & { error?: string }) : {};
        } catch {
          if (!cancelled) {
            setItems(placeholderTreeItems("Could not parse workspace response."));
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }

        if (!res.ok) {
          const errJson = data as { error?: string };
          const msg =
            typeof errJson.error === "string" && errJson.error.length > 0
              ? errJson.error
              : `Request failed (${res.status})`;
          if (!cancelled) {
            setItems(placeholderTreeItems(msg));
            setTruncated(false);
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }

        const wf = data as WorkspaceFilesResponse;
        const hasGitRemote = Boolean(wf.hasGitRemote);
        if (wf.reason === "no_environment") {
          if (!cancelled) {
            setItems(
              placeholderTreeItems("Start the runtime (pill) to create a container and clone the repository."),
            );
            setTruncated(false);
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }
        if (wf.reason === "not_active") {
          if (!cancelled) {
            setItems(placeholderTreeItems("Environment is stopped. Start the runtime to load files from the clone."));
            setTruncated(false);
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }
        if (wf.reason === "clone_pending") {
          if (!cancelled) {
            setItems(
              placeholderTreeItems(
                "Git clone is still finishing in the container. This page will refresh the tree automatically.",
              ),
            );
            setTruncated(false);
            setLoadState("loading");
            bumpTreeKey();
          }
          return;
        }
        if (wf.reason === "unreachable") {
          if (!cancelled) {
            const msg = wf.detail?.trim() ? `Environment service: ${wf.detail}` : "Could not list workspace files.";
            setItems(placeholderTreeItems(msg));
            setTruncated(false);
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }

        const next = filePathsToTreeItems(wf.paths, wf.rootLabel, {
          emptyHint:
            wf.paths.length === 0
              ? hasGitRemote
                ? "No files yet — Git clone may still be running, or this repo has no files under the workspace search paths."
                : "No files yet — the workspace may still be syncing, or the folder/upload was empty."
              : undefined,
        });
        if (!cancelled) {
          setItems(next);
          setTruncated(wf.truncated);
          setLoadState("ready");
          treeWasReadyRef.current = true;
          bumpTreeKey();
        }
        if (wf.paths.length > 0) {
          stopPoll();
        }
      } catch {
        if (!cancelled) {
          setItems(placeholderTreeItems("Network error while loading the file tree."));
          setLoadState("hint");
          bumpTreeKey();
        }
        stopPoll();
      }
    }

    if (environmentStatus === "PROVISIONING" || environmentStatus === "RUNNING") {
      pollTimer = window.setInterval(() => {
        void load();
      }, 3000);
    }
    void load();

    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [projectId, environmentStatus, treeRefreshKey, bumpTreeKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LiveExplorerTree
        key={treeKey}
        projectId={projectId}
        projectHasGitRemote={projectHasGitRemote}
        environmentStatus={environmentStatus}
        items={items}
        truncated={truncated}
        loadState={loadState}
        treeTabActive={treeTabActive}
      />
    </div>
  );
}

export type ProjectWorkspaceProps = {
  /** Route segment from `/projects/[projectSlug]`; used for in-page context. */
  projectSlug?: string;
  /** Prisma project id — enables Docker start/stop in the header. */
  projectId?: string;
  /** True when this project was created from a GitHub repo URL (not folder-only / blank). */
  projectHasGitRemote: boolean;
  /** Merged DB + environment-service status from SSR. */
  initialEnvironmentStatus?: SynaroProjectEnvironmentStatus;
  /** Only the project owner can create invite links. */
  canManageInvites?: boolean;
};

/**
 * Full-width project workspace (file tree, AI chat, iframe preview) — same layout as the former sample page.
 */
export function ProjectWorkspace({
  projectSlug,
  projectId,
  projectHasGitRemote,
  initialEnvironmentStatus = "INACTIVE",
  canManageInvites = false,
}: ProjectWorkspaceProps) {
  const [tab, setTab] = React.useState<TabKey>("chat");

  // Restore persisted tab after hydration (localStorage not available on server)
  React.useEffect(() => {
    if (!projectSlug) return;
    const saved = readProjectTab(projectSlug);
    if (saved) setTab(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (projectSlug) writeProjectTab(projectSlug, tab);
  }, [projectSlug, tab]);

  React.useEffect(() => {
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; tab?: TabKey }>).detail;
      if (detail?.type === "workspace-tab" && detail.tab) {
        setTab(detail.tab);
      }
    };
    window.addEventListener("synaro:onboarding-action", onAction);
    return () => window.removeEventListener("synaro:onboarding-action", onAction);
  }, []);
  const [environmentStatus, setEnvironmentStatus] =
    React.useState<SynaroProjectEnvironmentStatus>(initialEnvironmentStatus);
  const [dockerBusy, setDockerBusy] = React.useState(false);
  const [dockerError, setDockerError] = React.useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [treeRefreshKey, setTreeRefreshKey] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [runStatus, setRunStatus] = React.useState<"idle" | "starting" | "running" | "error">("idle");
  const [runError, setRunError] = React.useState<string | null>(null);
  const [showLogs, setShowLogs] = React.useState(false);
  const [logLines, setLogLines] = React.useState<string[]>([]);
  const runPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const logPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = React.useRef<HTMLDivElement>(null);
  const hasRestoredRunRef = React.useRef(false);
  const prevWorkspaceTabRef = React.useRef<ProjectWorkspaceTab | null>(null);

  React.useEffect(() => {
    setEnvironmentStatus(initialEnvironmentStatus);
  }, [initialEnvironmentStatus]);

  /** Refetch workspace file list when returning from Terminal (or chat) so shell edits show without a full reload. */
  React.useEffect(() => {
    const prev = prevWorkspaceTabRef.current;
    prevWorkspaceTabRef.current = tab;
    if (tab !== "tree") return;
    if (prev === null) return;
    if (prev === "tree") return;
    if (!projectId) return;
    setTreeRefreshKey((k) => k + 1);
  }, [tab, projectId]);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { projects?: SynaroProjectCardModel[] };
        const row = body.projects?.find((p) => p.id === projectId);
        if (row && !cancelled) setEnvironmentStatus(row.environmentStatus);
      } catch {
        /* ignore */
      }
    }
    void refresh();
    const id = window.setInterval(refresh, 18000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [projectId]);

  // Stop polling on unmount
  React.useEffect(() => () => {
    if (runPollRef.current) clearInterval(runPollRef.current);
    if (logPollRef.current) clearInterval(logPollRef.current);
  }, []);

  // Persist previewUrl to localStorage so it survives page refresh
  React.useEffect(() => {
    if (!projectId || !previewUrl) return;
    localStorage.setItem(`synaro:previewUrl:${projectId}`, previewUrl);
  }, [projectId, previewUrl]);

  // On mount: if environment is already RUNNING, check whether the app is still listening
  React.useEffect(() => {
    if (!projectId || environmentStatus !== "RUNNING" || hasRestoredRunRef.current) return;
    hasRestoredRunRef.current = true;

    void (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run`);
        if (!res.ok) return;
        const data = (await res.json()) as { ready?: boolean; previewUrl?: string };
        if (data.ready) {
          const url =
            data.previewUrl ??
            localStorage.getItem(`synaro:previewUrl:${projectId}`);
          setRunStatus("running");
          if (url) setPreviewUrl(url);
        }
      } catch {
        // ignore — app may not be running
      }
    })();
  }, [projectId, environmentStatus]);

  // Poll /tmp/app.log every 3 s while the log panel is open
  React.useEffect(() => {
    if (logPollRef.current) clearInterval(logPollRef.current);
    if (!showLogs || !projectId || runStatus !== "running") return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/run?action=logs`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { lines?: string[] };
        if (data.lines) {
          setLogLines(data.lines);
          logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      } catch {
        // ignore
      }
    };

    void fetchLogs();
    logPollRef.current = setInterval(() => void fetchLogs(), 3000);
    return () => {
      if (logPollRef.current) clearInterval(logPollRef.current);
    };
  }, [showLogs, projectId, runStatus]);

  const handleRun = React.useCallback(async () => {
    if (!projectId) return;
    setRunStatus("starting");
    setRunError(null);
    if (runPollRef.current) clearInterval(runPollRef.current);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run`, {
        method: "POST",
      });
      const data = (await res.json()) as { previewUrl?: string; command?: string; error?: string };
      if (!res.ok) {
        setRunStatus("error");
        setRunError(data.error ?? `Run failed (${res.status})`);
        return;
      }
      const url = data.previewUrl ?? null;

      // Poll until port 3000 is open in the container (max 60s)
      let elapsed = 0;
      runPollRef.current = setInterval(async () => {
        elapsed += 2000;
        try {
          const statusRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/run`);
          const statusData = (await statusRes.json()) as { ready?: boolean; previewUrl?: string };
          if (statusData.ready) {
            clearInterval(runPollRef.current!);
            runPollRef.current = null;
            setRunStatus("running");
            setPreviewUrl(statusData.previewUrl ?? url);
          } else if (elapsed >= 60_000) {
            clearInterval(runPollRef.current!);
            runPollRef.current = null;
            // Open anyway — app might still be installing
            setRunStatus("running");
            setPreviewUrl(url);
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch {
      setRunStatus("error");
      setRunError("Could not reach the server.");
    }
  }, [projectId]);

  const handleDockerPress = React.useCallback(
    async (action: "start" | "stop") => {
      if (!projectId) return;
      setDockerBusy(true);
      setDockerError(null);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/docker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const raw = await res.text();
        let data: { error?: string; project?: SynaroProjectCardModel } = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as typeof data;
          } catch {
            setDockerError("Invalid response from server.");
            return;
          }
        }
        if (!res.ok) {
          setDockerError(data.error ?? `Docker action failed (${res.status})`);
          return;
        }
        if (data.project) setEnvironmentStatus(data.project.environmentStatus);
        setTreeRefreshKey((k) => k + 1);
      } catch {
        setDockerError("Could not reach the app to update Docker.");
      } finally {
        setDockerBusy(false);
      }
    },
    [projectId],
  );

  const handleDownloadWorkspace = React.useCallback(async () => {
    if (!projectId || environmentStatus !== "RUNNING") return;
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/workspace-download`,
      );
      if (!res.ok) {
        const text = await res.text();
        let message = `Download failed (${res.status})`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) message = j.error;
        } catch {
          if (text) message = text;
        }
        setDownloadError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(projectSlug ?? "project").replace(/[^a-zA-Z0-9._-]+/g, "-")}-workspace.tar.gz`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Could not download the workspace. Check your connection and try again.");
    } finally {
      setDownloadBusy(false);
    }
  }, [projectId, projectSlug, environmentStatus]);

  const showPreviewPanel = runStatus === "running" && Boolean(previewUrl);

  React.useEffect(() => {
    if (environmentStatus === "RUNNING") return;
    setRunStatus("idle");
    setPreviewUrl(null);
    setShowLogs(false);
    if (runPollRef.current) {
      clearInterval(runPollRef.current);
      runPollRef.current = null;
    }
  }, [environmentStatus]);

  const tabButtonClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs transition sm:gap-2 sm:px-3 sm:text-sm",
      active
        ? "bg-muted text-foreground"
        : "bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3",
          showPreviewPanel &&
            "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] xl:grid-rows-1 xl:gap-0",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-background/40",
            showPreviewPanel
              ? "flex-[1_1_75vh] max-xl:min-h-[min(78vh,100%)] xl:min-h-0 xl:h-full xl:flex-none"
              : "min-h-0 flex-1",
          )}
        >
          <div
            className={cn(
              "flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3 sm:py-2.5",
              !showPreviewPanel && "xl:flex-row xl:items-center xl:gap-2 xl:px-4",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-col gap-2",
                !showPreviewPanel && "xl:flex-1 xl:flex-row xl:flex-wrap xl:items-center xl:gap-2",
              )}
            >
              <div
                data-onboarding="workspace-tabs"
                className={cn(
                  "-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  !showPreviewPanel && "xl:mx-0 xl:overflow-visible xl:pb-0",
                )}
              >
                <button
                  type="button"
                  data-onboarding="tab-chat"
                  onClick={() => setTab("chat")}
                  className={tabButtonClass(tab === "chat")}
                >
                  <MessageSquareText className="size-4" />
                  AI chat
                </button>
                <button
                  type="button"
                  data-onboarding="tab-tree"
                  onClick={() => setTab("tree")}
                  className={tabButtonClass(tab === "tree")}
                >
                  <FolderTree className="size-4" />
                  File tree
                </button>
                {projectSlug && (
                  <a
                    href={`/projects/${projectSlug}/editor`}
                    className={tabButtonClass(false)}
                  >
                    <PencilIcon className="size-4" />
                    Editor
                  </a>
                )}
                <button
                  type="button"
                  data-onboarding="tab-terminal"
                  onClick={() => setTab("terminal")}
                  className={tabButtonClass(tab === "terminal")}
                >
                  <TerminalSquare className="size-4" />
                  Terminal
                </button>
                <button
                  type="button"
                  data-onboarding="tab-deployments"
                  onClick={() => setTab("deployments")}
                  className={tabButtonClass(tab === "deployments")}
                >
                  <Rocket className="size-4" />
                  Deployments
                </button>
                {!showPreviewPanel && projectId && environmentStatus === "RUNNING" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRun()}
                      disabled={runStatus === "starting"}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm",
                        runStatus === "running"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : runStatus === "error"
                            ? "bg-destructive/10 text-destructive"
                            : runStatus === "starting"
                              ? "bg-muted text-muted-foreground"
                              : "bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400",
                      )}
                    >
                      {runStatus === "starting" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PlayIcon className="size-4" />
                      )}
                      {runStatus === "starting" ? "Starting…" : runStatus === "running" ? "Running" : "Run"}
                    </button>
                    {runStatus === "running" ? (
                      <button
                        type="button"
                        onClick={() => setShowLogs((v) => !v)}
                        className={tabButtonClass(showLogs)}
                      >
                        <ScrollText className="size-4" />
                        Logs
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {projectId ? (
              <div
                className={cn(
                  "flex flex-col gap-1",
                  !showPreviewPanel &&
                    "border-t border-border/40 px-1 pt-2 xl:ms-auto xl:shrink-0 xl:border-0 xl:pt-0",
                  showPreviewPanel && "border-t border-border/40 px-1 pt-2",
                )}
              >
                {showPreviewPanel ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {environmentStatus === "RUNNING" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleRun()}
                            disabled={runStatus === "starting"}
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm",
                              runStatus === "running"
                                ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                : runStatus === "error"
                                  ? "bg-destructive/10 text-destructive"
                                  : runStatus === "starting"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400",
                            )}
                          >
                            {runStatus === "starting" ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <PlayIcon className="size-4" />
                            )}
                            {runStatus === "starting"
                              ? "Starting…"
                              : runStatus === "running"
                                ? "Running"
                                : "Run"}
                          </button>
                          {runStatus === "running" ? (
                            <button
                              type="button"
                              onClick={() => setShowLogs((v) => !v)}
                              className={tabButtonClass(showLogs)}
                            >
                              <ScrollText className="size-4" />
                              Logs
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                      {environmentStatus === "RUNNING" ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadWorkspace()}
                          disabled={downloadBusy}
                          title="Download project folder as .tar.gz"
                          aria-label="Download project folder"
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70",
                            "bg-background/40 text-muted-foreground transition",
                            "hover:bg-muted hover:text-foreground",
                            "disabled:pointer-events-none disabled:opacity-50",
                          )}
                        >
                          {downloadBusy ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Download className="size-4" aria-hidden />
                          )}
                        </button>
                      ) : null}
                      {canManageInvites ? <ProjectShareInvite projectId={projectId} /> : null}
                      <span data-onboarding="docker-pill">
                        <SynaroProjectDockerPill
                          environmentStatus={environmentStatus}
                          interactive
                          busy={dockerBusy}
                          onPress={handleDockerPress}
                        />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end sm:gap-2">
                    {environmentStatus === "RUNNING" ? (
                      <button
                        type="button"
                        onClick={() => void handleDownloadWorkspace()}
                        disabled={downloadBusy}
                        title="Download project folder as .tar.gz"
                        aria-label="Download project folder"
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70",
                          "bg-background/40 text-muted-foreground transition",
                          "hover:bg-muted hover:text-foreground",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        {downloadBusy ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="size-4" aria-hidden />
                        )}
                      </button>
                    ) : null}
                    {canManageInvites ? <ProjectShareInvite projectId={projectId} /> : null}
                    <span data-onboarding="docker-pill">
                      <SynaroProjectDockerPill
                        environmentStatus={environmentStatus}
                        interactive
                        busy={dockerBusy}
                        onPress={handleDockerPress}
                      />
                    </span>
                  </div>
                )}
                {dockerError || runError || downloadError ? (
                  <div
                    className={cn(
                      "flex flex-col gap-0.5",
                      !showPreviewPanel && "sm:items-end xl:flex-row xl:gap-3",
                    )}
                  >
                    {downloadError ? (
                      <p className="text-[0.65rem] leading-snug text-destructive sm:text-xs">{downloadError}</p>
                    ) : null}
                    {dockerError ? (
                      <p className="text-[0.65rem] leading-snug text-destructive sm:text-xs">{dockerError}</p>
                    ) : null}
                    {runError ? (
                      <p className="text-[0.65rem] leading-snug text-destructive sm:text-xs">{runError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col",
                tab !== "tree" && "pointer-events-none invisible",
              )}
              aria-hidden={tab !== "tree"}
            >
              <TreePanel
                projectId={projectId}
                projectHasGitRemote={projectHasGitRemote}
                environmentStatus={environmentStatus}
                treeRefreshKey={treeRefreshKey}
                treeTabActive={tab === "tree"}
              />
            </div>
            <div
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col",
                workspaceExplorerTabPaddingClass,
                tab !== "terminal" && "pointer-events-none invisible",
              )}
              aria-hidden={tab !== "terminal"}
            >
              <ProjectContainerTerminal
                projectId={projectId}
                environmentStatus={environmentStatus}
                visible={tab === "terminal"}
                className={workspaceExplorerPrimaryCardSizeClass}
              />
            </div>
            <div
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col overflow-hidden p-2 sm:p-4",
                tab !== "chat" && "pointer-events-none invisible",
              )}
              aria-hidden={tab !== "chat"}
            >
              <AnimatedAIChat
                className="h-full w-full min-w-0"
                projectId={projectId}
                projectSlug={projectSlug}
              />
            </div>
            <div
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col overflow-auto p-4 sm:p-6",
                tab !== "deployments" && "pointer-events-none invisible",
              )}
              aria-hidden={tab !== "deployments"}
            >
              <div className="flex min-h-full w-full flex-col items-center justify-center py-4">
                <div className="w-full max-w-lg space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Deployments</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Preview your running app or deploy it for permanent public access.
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <PlayIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Preview</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">Temporary</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Start your project and preview it live in the browser. Preview runs while the container is active.
                  </p>
                  {runStatus === "running" && previewUrl ? (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted px-3 py-2 text-xs text-foreground transition hover:bg-accent"
                    >
                      <ExternalLink className="size-3.5" />
                      Open preview
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      {environmentStatus === "RUNNING" ? "Click Run to start the app preview." : "Start the container first, then click Run."}
                    </p>
                  )}
                </div>

                {/* Deploy */}
                <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Rocket className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Deploy</span>
                    <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[0.7rem] text-violet-500">Coming soon</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deploy your project to a permanent public URL like <span className="font-mono text-foreground/80">{projectSlug}.synaro.tech</span>. Custom domains supported.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted px-3 py-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
                  >
                    <Rocket className="size-3.5" />
                    Deploy to production
                  </button>
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* Log panel — shown when app is running and user toggles Logs */}
          {showLogs ? (
            <div className="flex h-40 shrink-0 flex-col border-t border-border/60 sm:h-48">
              <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ScrollText className="size-3.5" />
                  App logs
                </p>
                <button
                  type="button"
                  onClick={() => setShowLogs(false)}
                  className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                  aria-label="Close logs"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                {logLines.length === 0 ? (
                  <p className="py-2 text-[0.7rem] text-muted-foreground/60">(waiting for output…)</p>
                ) : (
                  logLines.map((line, i) => (
                    <div
                      key={i}
                      className="whitespace-pre-wrap break-all font-mono text-[0.7rem] leading-5 text-muted-foreground"
                    >
                      {line || " "}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          ) : null}
        </div>

        {showPreviewPanel ? (
          <ProjectIframePreview
            className="order-last max-xl:max-h-[28vh] max-xl:min-h-[11rem] max-xl:shrink-0 xl:order-none xl:h-full xl:max-h-none xl:min-h-0"
            title={projectSlug ? `Preview — ${humanizeProjectSlug(projectSlug)}` : "Preview"}
            previewUrl={previewUrl}
          />
        ) : null}
      </div>
    </div>
  );
}
