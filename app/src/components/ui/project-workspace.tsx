import * as React from "react";
import { useRouter } from "next/router";
import {
  Download,
  ExternalLink,
  FileIcon,
  FilePlus2,
  FolderIcon,
  FolderOpenIcon,
  FolderPlus,
  Loader2,
  MessageSquareText,
  FolderTree,
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
import { useTranslation } from "@/components/ui/locale-provider";
import { WorkspaceChatPreviewProvider, useWorkspaceChatPreview } from "@/components/ui/workspace-chat-preview";
import { WorkspaceFileEditorPanel } from "@/components/ui/workspace-file-editor";
import {
  explorerTargetFromItemId,
  WorkspaceExplorerContextMenu,
  type ExplorerMenuTarget,
} from "@/components/ui/workspace-explorer-context-menu";
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
import { dispatchWorkspaceTab } from "@/lib/onboarding-tour-steps";
import {
  defaultExpandedWorkspaceFolderIds,
  filePathsToTreeItems,
  relativePathFromTreeItemId,
  type WorkspaceExplorerItem,
} from "@/lib/workspace-path-tree";
import type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";
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
  environmentStatus: SynaroProjectEnvironmentStatus;
  items: Record<string, WorkspaceExplorerItem>;
  loadState: "idle" | "loading" | "ready" | "hint";
  /** True while the File tree tab is visible — used to auto-expand the root folder on each visit. */
  treeTabActive: boolean;
  onTreeMutated: () => void;
};

function LiveExplorerTree({
  projectId,
  environmentStatus,
  items,
  loadState,
  treeTabActive,
  onTreeMutated,
}: LiveExplorerTreeProps) {
  const { t } = useTranslation();
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
  const [menuTarget, setMenuTarget] = React.useState<ExplorerMenuTarget | null>(null);
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [toolbarNameDialog, setToolbarNameDialog] = React.useState<
    "newFile" | "newFolder" | null
  >(null);
  const closeEditorTabRef = React.useRef<
    ((path: string, opts?: { includeChildren?: boolean }) => void) | null
  >(null);
  const renameEditorTabRef = React.useRef<
    ((from: string, to: string, isFolder?: boolean) => void) | null
  >(null);

  const canMutate = Boolean(projectId && environmentStatus === "RUNNING" && loadState === "ready");

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

  const editorFilePath = React.useMemo(() => {
    if (!selectedId || !selectedPath || selectedId === "root" || selectedId.startsWith("syn:")) {
      return null;
    }
    if (!selectedItem || selectedItem.isFolder()) return null;
    return selectedPath;
  }, [selectedId, selectedPath, selectedItem]);

  const selectionLabel = selectedItem ? selectedItem.getItemName() : null;

  const handleActiveEditorPath = React.useCallback(
    (path: string | null) => {
      if (!path) return;
      const match = visibleItems.find((it) => relativePathFromTreeItemId(it.getId()) === path);
      if (match) setSelectedId(match.getId());
    },
    [visibleItems],
  );

  const openFileInEditor = React.useCallback(
    (path: string) => {
      const fileId = `file:${path}`;
      setSelectedId(fileId);
    },
    [],
  );

  const contextParentDir = React.useMemo((): string | null => {
    if (!selectedId || selectedId === "root" || selectedId.startsWith("syn:")) return null;
    const path = relativePathFromTreeItemId(selectedId);
    if (!path) return null;
    const item = visibleItems.find((it) => it.getId() === selectedId);
    if (item?.isFolder()) return path;
    return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
  }, [selectedId, visibleItems]);

  const openContextMenu = React.useCallback(
    (e: React.MouseEvent, target: ExplorerMenuTarget) => {
      if (!canMutate) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setMenuTarget(target);
      if (target.kind !== "background") {
        setSelectedId(target.itemId);
      }
    },
    [canMutate],
  );

  const closeContextMenu = React.useCallback(() => {
    setMenuTarget(null);
    setMenuPosition(null);
  }, []);

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-3 lg:h-full lg:grid-rows-1 lg:gap-3",
        workspaceExplorerTabPaddingClass,
        "max-lg:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
          workspaceExplorerPrimaryCardSizeClass,
        )}
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest("[data-tree-item]")) return;
          if ((e.target as HTMLElement).closest("button,input")) return;
          openContextMenu(e, { kind: "background", parentDir: contextParentDir });
        }}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("workspace.projectFiles")}
            {loadState === "loading" ? (
              <span className="ms-2 font-normal text-muted-foreground">· {t("common.loading")}</span>
            ) : null}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <p className="shrink-0 text-xs text-muted-foreground">
              {t("workspace.itemsCount", { count: visibleItems.length })}
            </p>
            {canMutate ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setToolbarNameDialog("newFile")}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title={t("workspace.newFile")}
                  aria-label={t("workspace.newFile")}
                >
                  <FilePlus2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setToolbarNameDialog("newFolder")}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title={t("workspace.newFolder")}
                  aria-label={t("workspace.newFolder")}
                >
                  <FolderPlus className="size-3.5" />
                </button>
              </div>
            ) : null}
            <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("workspace.search")}
                className="h-7 rounded-lg px-2 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <Tree className="gap-0.5" indent={indent} tree={tree}>
            {visibleItems.map((item) => {
              const isSelected = selectedId === item.getId();
              const menuTargetForItem = explorerTargetFromItemId(item.getId(), item.isFolder());
              return (
                <TreeItem key={item.getId()} item={item}>
                  <TreeItemLabel
                    data-tree-item
                    onClick={() => setSelectedId(item.getId())}
                    onContextMenu={(e) => {
                      if (!menuTargetForItem) return;
                      openContextMenu(e, menuTargetForItem);
                    }}
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
        <WorkspaceExplorerContextMenu
          projectId={projectId}
          canMutate={canMutate}
          target={menuTarget}
          position={menuPosition}
          onClose={closeContextMenu}
          onOpenFile={openFileInEditor}
          onTreeMutated={onTreeMutated}
          externalNameDialog={
            toolbarNameDialog
              ? {
                  mode: toolbarNameDialog,
                  parentDir: contextParentDir,
                  open: true,
                  onOpenChange: (open) => {
                    if (!open) setToolbarNameDialog(null);
                  },
                }
              : null
          }
          onPathRemoved={(path, isFolder) => {
            closeEditorTabRef.current?.(path, { includeChildren: isFolder });
            if (selectedPath === path || (isFolder && selectedPath?.startsWith(`${path}/`))) {
              setSelectedId(null);
            }
          }}
          onPathRenamed={(from, to, isFolder) => {
            renameEditorTabRef.current?.(from, to, isFolder);
            if (selectedPath === from) {
              setSelectedId(isFolder ? `dir:${to}` : `file:${to}`);
            } else if (isFolder && selectedPath?.startsWith(`${from}/`)) {
              setSelectedId(`file:${to}${selectedPath.slice(from.length)}`);
            }
          }}
        />
      </div>

      <WorkspaceFileEditorPanel
        projectId={projectId}
        openFilePath={editorFilePath}
        openFileLabel={selectionLabel}
        environmentStatus={environmentStatus}
        onActivePathChange={handleActiveEditorPath}
        onRegisterCloseTab={(fn) => {
          closeEditorTabRef.current = fn;
        }}
        onRegisterRenameTab={(fn) => {
          renameEditorTabRef.current = fn;
        }}
      />
    </div>
  );
}

type TreePanelProps = {
  projectId?: string;
  environmentStatus: SynaroProjectEnvironmentStatus;
  treeRefreshKey: number;
  treeTabActive: boolean;
  onTreeMutated: () => void;
};

function TreePanel({
  projectId,
  environmentStatus,
  treeRefreshKey,
  treeTabActive,
  onTreeMutated,
}: TreePanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<Record<string, WorkspaceExplorerItem>>(() =>
    placeholderTreeItems(t("workspace.connectToProject")),
  );
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
      setItems(placeholderTreeItems(t("workspace.connectToProject")));
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
        setItems(placeholderTreeItems(t("workspace.loadingFileList")));
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
            setItems(placeholderTreeItems(t("workspace.couldNotParseWorkspace")));
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
              : t("workspace.requestFailed", { status: res.status });
          if (!cancelled) {
            setItems(placeholderTreeItems(msg));
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
              placeholderTreeItems(t("workspace.startRuntimeToClone")),
            );
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }
        if (wf.reason === "not_active") {
          if (!cancelled) {
            setItems(placeholderTreeItems(t("workspace.environmentStopped")));
            setLoadState("hint");
            bumpTreeKey();
          }
          stopPoll();
          return;
        }
        if (wf.reason === "clone_pending") {
          if (!cancelled) {
            setItems(
              placeholderTreeItems(t("workspace.gitCloneFinishing")),
            );
            setLoadState("loading");
            bumpTreeKey();
          }
          return;
        }
        if (wf.reason === "unreachable") {
          if (!cancelled) {
            const msg = wf.detail?.trim()
              ? t("workspace.environmentService", { detail: wf.detail })
              : t("workspace.couldNotListFiles");
            setItems(placeholderTreeItems(msg));
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
                ? t("workspace.noFilesCloneRunning")
                : t("workspace.noFilesEmpty")
              : undefined,
        });
        if (!cancelled) {
          setItems(next);
          setLoadState("ready");
          treeWasReadyRef.current = true;
          bumpTreeKey();
        }
        if (wf.paths.length > 0) {
          stopPoll();
        }
      } catch {
        if (!cancelled) {
          setItems(placeholderTreeItems(t("workspace.networkErrorFileTree")));
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
  }, [projectId, environmentStatus, treeRefreshKey, bumpTreeKey, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LiveExplorerTree
        key={treeKey}
        projectId={projectId}
        environmentStatus={environmentStatus}
        items={items}
        loadState={loadState}
        treeTabActive={treeTabActive}
        onTreeMutated={onTreeMutated}
      />
    </div>
  );
}

function ProjectChatWithPreview({
  projectId,
  projectSlug,
  environmentStatus,
}: {
  projectId?: string;
  projectSlug?: string;
  environmentStatus: SynaroProjectEnvironmentStatus;
}) {
  const { previewPath, openFile, closePreview } = useWorkspaceChatPreview()!;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full gap-0 lg:gap-3",
        previewPath && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,42%)]",
      )}
    >
      <AnimatedAIChat
        className="h-full min-h-0 min-w-0 flex-1"
        projectId={projectId}
        projectSlug={projectSlug}
      />
      {previewPath ? (
        <div className="mt-3 flex min-h-[min(40vh,20rem)] min-w-0 flex-col lg:mt-0 lg:min-h-0">
          <WorkspaceFileEditorPanel
            projectId={projectId}
            openFilePath={previewPath}
            environmentStatus={environmentStatus}
            onAllTabsClosed={closePreview}
            onActivePathChange={(path) => {
              if (path) openFile(path);
            }}
            className="h-full min-h-0"
          />
        </div>
      ) : null}
    </div>
  );
}

export type ProjectWorkspaceProps = {
  /** Route segment from `/projects/[projectSlug]`; used for in-page context. */
  projectSlug?: string;
  /** Prisma project id — enables Docker start/stop in the header. */
  projectId?: string;
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
  initialEnvironmentStatus = "INACTIVE",
  canManageInvites = false,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<TabKey>("chat");

  const tabFromQuery = router.query.tab;
  const queryTab =
    typeof tabFromQuery === "string" &&
    (tabFromQuery === "tree" ||
      tabFromQuery === "chat" ||
      tabFromQuery === "terminal" ||
      tabFromQuery === "deployments")
      ? (tabFromQuery as TabKey)
      : null;

  // Restore persisted tab after hydration (localStorage not available on server)
  React.useEffect(() => {
    if (!projectSlug) return;
    if (queryTab) {
      setTab(queryTab);
      return;
    }
    const saved = readProjectTab(projectSlug);
    if (saved) setTab(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTab]);

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

  // Periodically trigger idle-container cleanup in the background.
  React.useEffect(() => {
    if (!projectId) return;
    const id = window.setInterval(() => {
      void fetch("/api/cron/auto-stop", { method: "POST" }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
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
        setRunError(data.error ?? t("workspace.runFailed", { status: res.status }));
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
      setRunError(t("workspace.couldNotReachServer"));
    }
  }, [projectId, t]);

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
            setDockerError(t("workspace.invalidServerResponse"));
            return;
          }
        }
        if (!res.ok) {
          setDockerError(data.error ?? t("workspace.dockerActionFailed", { status: res.status }));
          return;
        }
        if (data.project) setEnvironmentStatus(data.project.environmentStatus);
        setTreeRefreshKey((k) => k + 1);
      } catch {
        setDockerError(t("workspace.couldNotUpdateDocker"));
      } finally {
        setDockerBusy(false);
      }
    },
    [projectId, t],
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
        let message = t("workspace.downloadFailed", { status: res.status });
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
      setDownloadError(t("workspace.downloadError"));
    } finally {
      setDownloadBusy(false);
    }
  }, [projectId, projectSlug, environmentStatus, t]);

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
              "flex shrink-0 flex-col gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5",
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
                  onClick={() => {
                    setTab("chat");
                    dispatchWorkspaceTab("chat");
                  }}
                  className={tabButtonClass(tab === "chat")}
                >
                  <MessageSquareText className="size-4" />
                  {t("workspace.aiChat")}
                </button>
                <button
                  type="button"
                  data-onboarding="tab-tree"
                  onClick={() => {
                    setTab("tree");
                    dispatchWorkspaceTab("tree");
                  }}
                  className={tabButtonClass(tab === "tree")}
                >
                  <FolderTree className="size-4" />
                  {t("workspace.fileTree")}
                </button>
                <button
                  type="button"
                  data-onboarding="tab-terminal"
                  onClick={() => {
                    setTab("terminal");
                    dispatchWorkspaceTab("terminal");
                  }}
                  className={tabButtonClass(tab === "terminal")}
                >
                  <TerminalSquare className="size-4" />
                  {t("workspace.terminal")}
                </button>
                <button
                  type="button"
                  data-onboarding="tab-deployments"
                  onClick={() => {
                    setTab("deployments");
                    dispatchWorkspaceTab("deployments");
                  }}
                  className={tabButtonClass(tab === "deployments")}
                >
                  <Rocket className="size-4" />
                  {t("workspace.deployments")}
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
                      {runStatus === "starting"
                        ? t("workspace.starting")
                        : runStatus === "running"
                          ? t("workspace.running")
                          : t("workspace.run")}
                    </button>
                    {runStatus === "running" ? (
                      <button
                        type="button"
                        onClick={() => setShowLogs((v) => !v)}
                        className={tabButtonClass(showLogs)}
                      >
                        <ScrollText className="size-4" />
                        {t("workspace.logs")}
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
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-green-500/15 px-2.5 py-2 text-xs font-medium text-green-600 transition sm:gap-2 sm:px-3 sm:text-sm dark:text-green-400"
                          >
                            <PlayIcon className="size-4" />
                            {t("workspace.running")}
                          </button>
                          {runStatus === "running" ? (
                            <button
                              type="button"
                              onClick={() => setShowLogs((v) => !v)}
                              className={tabButtonClass(showLogs)}
                            >
                              <ScrollText className="size-4" />
                              {t("workspace.logs")}
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
                          title={t("workspace.downloadProjectTitle")}
                          aria-label={t("workspace.downloadProject")}
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
                        title={t("workspace.downloadProjectTitle")}
                        aria-label={t("workspace.downloadProject")}
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
                environmentStatus={environmentStatus}
                treeRefreshKey={treeRefreshKey}
                treeTabActive={tab === "tree"}
                onTreeMutated={() => setTreeRefreshKey((k) => k + 1)}
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
              <WorkspaceChatPreviewProvider>
                <ProjectChatWithPreview
                  projectId={projectId}
                  projectSlug={projectSlug}
                  environmentStatus={environmentStatus}
                />
              </WorkspaceChatPreviewProvider>
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
                    <h2 className="text-base font-semibold text-foreground">{t("workspace.deployments")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("workspace.deploymentsDescription")}
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <PlayIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t("workspace.preview")}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">{t("workspace.previewTemporary")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("workspace.previewDescription")}
                  </p>
                  {runStatus === "running" && previewUrl ? (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted px-3 py-2 text-xs text-foreground transition hover:bg-accent"
                    >
                      <ExternalLink className="size-3.5" />
                      {t("workspace.openPreview")}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      {environmentStatus === "RUNNING"
                        ? t("workspace.clickRunPreview")
                        : t("workspace.startContainerFirst")}
                    </p>
                  )}
                </div>

                {/* Deploy */}
                <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Rocket className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t("workspace.deployments")}</span>
                    <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[0.7rem] text-violet-500">{t("common.comingSoon")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("workspace.deployDescription", { slug: projectSlug ?? "project" })}
                  </p>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted px-3 py-2 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
                  >
                    <Rocket className="size-3.5" />
                    {t("workspace.deployToProduction")}
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
                  {t("workspace.appLogs")}
                </p>
                <button
                  type="button"
                  onClick={() => setShowLogs(false)}
                  className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
                  aria-label={t("workspace.closeLogs")}
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                {logLines.length === 0 ? (
                  <p className="py-2 text-[0.7rem] text-muted-foreground/60">{t("workspace.waitingForOutput")}</p>
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
            title={
              projectSlug
                ? t("workspace.previewTitle", { name: humanizeProjectSlug(projectSlug) })
                : t("workspace.preview")
            }
            previewUrl={previewUrl}
          />
        ) : null}
      </div>
    </div>
  );
}
