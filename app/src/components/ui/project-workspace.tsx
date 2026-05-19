import * as React from "react";
import {
  ExternalLink,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2,
  MessageSquareText,
  FolderTree,
  TerminalSquare,
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
  filePathsToTreeItems,
  relativePathFromTreeItemId,
  type WorkspaceExplorerItem,
} from "@/lib/workspace-path-tree";
import type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";
import type { WorkspaceSelectionApiResponse } from "@/lib/workspace-selection-types";
import { cn } from "@/lib/utils";

type TabKey = ProjectWorkspaceTab;

const indent = 20;

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
}: LiveExplorerTreeProps) {
  /** Restore from localStorage on every mount (tab switches remount this tree via `treeKey`). */
  const [expandedItems, setExpandedItems] = React.useState<string[]>(() =>
    typeof window !== "undefined" && projectId ? readWorkspaceTreeExpanded(projectId) ?? [] : [],
  );
  const initialHydratedRef = React.useRef(false);
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
        const next = prev.filter((id) => keys.has(id));
        return next;
      });
      allowPersistExpandedRef.current = true;
      return;
    }
    setExpandedItems((prev) => {
      const next = prev.filter((id) => keys.has(id));
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [projectId, loadState, items]);

  const handleTreeSetState = React.useCallback(
    (updaterOrValue: Updater<Partial<TreeState<WorkspaceExplorerItem>>>) => {
      if (typeof updaterOrValue === "function") return;
      if (!Array.isArray(updaterOrValue.expandedItems)) return;
      setExpandedItems(updaterOrValue.expandedItems);
      if (allowPersistExpandedRef.current && projectId) {
        writeWorkspaceTreeExpanded(projectId, updaterOrValue.expandedItems);
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
        "grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 pt-0 lg:h-full lg:grid-rows-1 lg:gap-3",
        showSelectionPanel ? "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" : "lg:grid-cols-1",
      )}
    >
        <div className="flex max-h-[min(50vh,28rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:h-full lg:max-h-none">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              Project files
              {loadState === "loading" ? (
                <span className="ms-2 font-normal text-muted-foreground">· loading…</span>
              ) : null}
            </p>
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
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {selectedItem ? selectedItem.getItemName() : selectedPath}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{selectedPath}</p>
            </div>
            <div className="hidden sm:block">
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
};

function TreePanel({ projectId, projectHasGitRemote, environmentStatus, treeRefreshKey }: TreePanelProps) {
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
  const [tab, setTab] = React.useState<TabKey>(() => {
    if (typeof window === "undefined" || !projectSlug) return "tree";
    return readProjectTab(projectSlug) ?? "tree";
  });

  React.useEffect(() => {
    if (projectSlug) writeProjectTab(projectSlug, tab);
  }, [projectSlug, tab]);
  const [environmentStatus, setEnvironmentStatus] =
    React.useState<SynaroProjectEnvironmentStatus>(initialEnvironmentStatus);
  const [dockerBusy, setDockerBusy] = React.useState(false);
  const [dockerError, setDockerError] = React.useState<string | null>(null);
  const [treeRefreshKey, setTreeRefreshKey] = React.useState(0);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
              <button
                type="button"
                onClick={() => setTab("terminal")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  tab === "terminal"
                    ? "bg-muted text-foreground"
                    : "bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <TerminalSquare className="size-4" />
                Terminal
              </button>
              {projectId ? (
                <div className="ms-auto flex max-w-[min(100%,16rem)] flex-col items-end gap-1 sm:max-w-xs">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canManageInvites ? <ProjectShareInvite projectId={projectId} /> : null}
                    <SynaroProjectDockerPill
                      environmentStatus={environmentStatus}
                      interactive
                      busy={dockerBusy}
                      onPress={handleDockerPress}
                    />
                  </div>
                  {dockerError ? (
                    <p className="text-right text-[0.65rem] leading-snug text-destructive sm:text-xs">
                      {dockerError}
                    </p>
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
                />
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex min-h-0 flex-col",
                  tab !== "terminal" && "pointer-events-none invisible",
                )}
                aria-hidden={tab !== "terminal"}
              >
                <ProjectContainerTerminal
                  projectId={projectId}
                  environmentStatus={environmentStatus}
                  visible={tab === "terminal"}
                  className="m-3 min-h-[min(24rem,50vh)] flex-1 sm:m-4 xl:min-h-0"
                />
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex min-h-0 flex-1 items-center justify-center overflow-auto p-4",
                  tab !== "chat" && "pointer-events-none invisible",
                )}
                aria-hidden={tab !== "chat"}
              >
                <AnimatedAIChat className="w-full max-w-3xl" />
              </div>
            </div>
          </div>

          <ProjectIframePreview
            className="h-full min-h-[40vh] xl:min-h-0"
            title={projectSlug ? `Preview — ${humanizeProjectSlug(projectSlug)}` : "Preview"}
          />
        </div>
    </div>
  );
}
