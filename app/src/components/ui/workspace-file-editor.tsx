"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CheckIcon, Loader2, SaveIcon, XIcon } from "lucide-react";

import type { SynaroProjectEnvironmentStatus } from "@/components/ui/project-cards-grid";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type EditorTab = {
  path: string;
  label: string;
  content: string;
  isDirty: boolean;
  loading: boolean;
  loadError: string | null;
  contentTruncated: boolean;
};

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    xml: "xml",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    sh: "shell",
    bash: "shell",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sql: "sql",
    prisma: "prisma",
    graphql: "graphql",
    dockerfile: "dockerfile",
    env: "ini",
    gitignore: "ini",
    lock: "yaml",
  };
  return map[ext] ?? "plaintext";
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

async function fetchFileContent(
  projectId: string,
  path: string,
  signal: AbortSignal,
): Promise<{ content: string; contentTruncated: boolean }> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/workspace-selection?path=${encodeURIComponent(path)}`,
    { signal, cache: "no-store" },
  );
  const data = (await res.json()) as {
    content?: string | null;
    error?: string;
    kind?: string;
    contentTruncated?: boolean;
  };
  if (!res.ok) throw new Error(data.error ?? `Failed to load (${res.status})`);
  if (data.kind === "directory") throw new Error("Cannot open a directory as a file.");
  if (data.kind === "missing" || data.kind === "notfile") {
    throw new Error("This path is not a readable file in the workspace.");
  }
  return {
    content: data.content ?? "",
    contentTruncated: Boolean(data.contentTruncated),
  };
}

export function WorkspaceFileEditorPanel({
  projectId,
  openFilePath,
  openFileLabel,
  environmentStatus,
  onActivePathChange,
  onAllTabsClosed,
  onRegisterCloseTab,
  onRegisterRenameTab,
  className,
}: {
  projectId?: string;
  /** When the user selects a file in the tree, open or focus this path. */
  openFilePath: string | null;
  openFileLabel?: string | null;
  environmentStatus: SynaroProjectEnvironmentStatus;
  onActivePathChange?: (path: string | null) => void;
  /** Called when the user closes the last editor tab. */
  onAllTabsClosed?: () => void;
  onRegisterCloseTab?: (closeTab: (path: string, opts?: { includeChildren?: boolean }) => void) => void;
  onRegisterRenameTab?: (renameTab: (from: string, to: string, isFolder?: boolean) => void) => void;
  className?: string;
}) {
  const [tabs, setTabs] = React.useState<EditorTab[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const loadGenRef = React.useRef(0);

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const canEdit = Boolean(projectId && activeTab && environmentStatus === "RUNNING");

  const setActive = React.useCallback(
    (path: string | null) => {
      setActivePath(path);
      onActivePathChange?.(path);
    },
    [onActivePathChange],
  );

  const loadTabContent = React.useCallback(
    (path: string) => {
      if (!projectId || environmentStatus !== "RUNNING") return;
      const gen = ++loadGenRef.current;

      setTabs((prev) =>
        prev.map((t) =>
          t.path === path ? { ...t, loading: true, loadError: null } : t,
        ),
      );

      const ac = new AbortController();
      void fetchFileContent(projectId, path, ac.signal)
        .then(({ content, contentTruncated }) => {
          if (gen !== loadGenRef.current) return;
          setTabs((prev) =>
            prev.map((t) =>
              t.path === path
                ? {
                    ...t,
                    content,
                    contentTruncated,
                    loading: false,
                    loadError: null,
                    isDirty: false,
                  }
                : t,
            ),
          );
        })
        .catch((e) => {
          if (ac.signal.aborted || gen !== loadGenRef.current) return;
          setTabs((prev) =>
            prev.map((t) =>
              t.path === path
                ? {
                    ...t,
                    loading: false,
                    loadError: e instanceof Error ? e.message : "Failed to load file",
                  }
                : t,
            ),
          );
        });

      return () => ac.abort();
    },
    [projectId, environmentStatus],
  );

  const ensureTabOpen = React.useCallback(
    (path: string, label?: string) => {
      const name = label ?? basename(path);
      let shouldLoad = false;
      setTabs((prev) => {
        if (prev.some((t) => t.path === path)) return prev;
        shouldLoad = true;
        return [
          ...prev,
          {
            path,
            label: name,
            content: "",
            isDirty: false,
            loading: true,
            loadError: null,
            contentTruncated: false,
          },
        ];
      });
      setActive(path);
      if (shouldLoad) loadTabContent(path);
    },
    [loadTabContent, setActive],
  );

  React.useEffect(() => {
    if (!openFilePath) return;
    ensureTabOpen(openFilePath, openFileLabel ?? undefined);
  }, [openFilePath, openFileLabel, ensureTabOpen]);

  const closeTab = React.useCallback(
    (path: string, opts?: { includeChildren?: boolean }) => {
      setTabs((prev) => {
        const next = prev.filter((t) => {
          if (t.path === path) return false;
          if (opts?.includeChildren && t.path.startsWith(`${path}/`)) return false;
          return true;
        });
        const activeRemoved =
          activePath === path ||
          (opts?.includeChildren && activePath?.startsWith(`${path}/`));
        if (activeRemoved) {
          const idx = prev.findIndex((t) => t.path === activePath);
          const fallback = next[idx] ?? next[idx - 1] ?? null;
          setActive(fallback?.path ?? null);
        }
        if (next.length === 0) onAllTabsClosed?.();
        return next;
      });
      setSaveStatus("idle");
      setSaveError(null);
    },
    [activePath, onAllTabsClosed, setActive],
  );

  const renameTab = React.useCallback(
    (from: string, to: string, isFolder?: boolean) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.path === from) return { ...t, path: to, label: basename(to) };
          if (isFolder && t.path.startsWith(`${from}/`)) {
            const nextPath = `${to}${t.path.slice(from.length)}`;
            return { ...t, path: nextPath, label: basename(nextPath) };
          }
          return t;
        }),
      );
      if (activePath === from) {
        setActive(to);
      } else if (isFolder && activePath?.startsWith(`${from}/`)) {
        setActive(`${to}${activePath.slice(from.length)}`);
      }
    },
    [activePath, setActive],
  );

  React.useEffect(() => {
    onRegisterCloseTab?.(closeTab);
  }, [closeTab, onRegisterCloseTab]);

  React.useEffect(() => {
    onRegisterRenameTab?.(renameTab);
  }, [renameTab, onRegisterRenameTab]);

  const updateActiveContent = React.useCallback((content: string) => {
    if (!activePath) return;
    setTabs((prev) =>
      prev.map((t) => (t.path === activePath ? { ...t, content, isDirty: true } : t)),
    );
    setSaveStatus("idle");
  }, [activePath]);

  const handleSave = React.useCallback(async () => {
    if (!projectId || !activeTab || !activeTab.isDirty) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace-write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeTab.path, content: activeTab.content }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSaveStatus("error");
        setSaveError(data.error ?? "Save failed");
        return;
      }
      setTabs((prev) =>
        prev.map((t) => (t.path === activeTab.path ? { ...t, isDirty: false } : t)),
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setSaveError("Network error");
    }
  }, [projectId, activeTab]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w" && activePath) {
        e.preventDefault();
        closeTab(activePath);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, closeTab, activePath]);

  return (
    <div
      className={cn(
        "flex max-h-[min(52vh,28rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card lg:max-h-none lg:flex-1",
        className,
      )}
    >
      <div className="flex shrink-0 items-stretch border-b border-border/60 bg-zinc-950/50">
        <div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.length === 0 ? (
            <span className="px-3 py-2 text-xs text-muted-foreground">Open a file from the tree</span>
          ) : (
            tabs.map((tab) => {
              const isActive = tab.path === activePath;
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => setActive(tab.path)}
                  className={cn(
                    "group flex max-w-[12rem] shrink-0 items-center gap-1 border-r border-border/60 px-2.5 py-1.5 text-left text-xs transition",
                    isActive
                      ? "bg-card text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  title={tab.path}
                >
                  <span className="truncate">{tab.label}</span>
                  {tab.isDirty ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unsaved" />
                  ) : null}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        closeTab(tab.path);
                      }
                    }}
                    className="ml-0.5 shrink-0 rounded p-0.5 opacity-0 transition hover:bg-muted group-hover:opacity-100"
                    aria-label={`Close ${tab.label}`}
                  >
                    <XIcon className="size-3" />
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l border-border/60 px-2">
          {saveError ? <p className="max-w-[8rem] truncate text-[0.65rem] text-destructive">{saveError}</p> : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canEdit || !activeTab?.isDirty || saveStatus === "saving"}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium transition",
              saveStatus === "saved"
                ? "text-green-600 dark:text-green-400"
                : activeTab?.isDirty
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground opacity-40",
            )}
            title="Save (⌘S / Ctrl+S)"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : saveStatus === "saved" ? (
              <CheckIcon className="size-3" />
            ) : (
              <SaveIcon className="size-3" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-zinc-950/80">
        {environmentStatus !== "RUNNING" ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Start the project environment to edit files.
          </div>
        ) : !activeTab ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select a file in the tree to open it in a new tab.
          </div>
        ) : activeTab.loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : activeTab.loadError ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-destructive">{activeTab.loadError}</p>
          </div>
        ) : (
          <>
            {activeTab.contentTruncated ? (
              <p className="absolute left-3 right-3 top-2 z-10 text-[0.65rem] text-amber-700 dark:text-amber-400">
                Large file — content may be truncated in the workspace.
              </p>
            ) : null}
            <MonacoEditor
              key={activeTab.path}
              height="100%"
              language={getLanguageFromPath(activeTab.path)}
              value={activeTab.content}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: activeTab.contentTruncated ? 28 : 12, bottom: 12 },
                lineNumbersMinChars: 3,
              }}
              onChange={(value) => updateActiveContent(value ?? "")}
            />
          </>
        )}
      </div>
    </div>
  );
}
