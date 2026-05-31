"use client";

import * as React from "react";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2,
  SaveIcon,
} from "lucide-react";

import { whereProjectBySlugForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";
import type { WorkspaceFilesResponse } from "@/lib/workspace-files-types";
import { filePathsToTreeItems, relativePathFromTreeItemId, type WorkspaceExplorerItem } from "@/lib/workspace-path-tree";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Props = {
  projectId: string;
  projectSlug: string;
  projectName: string;
};

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    json: "json", md: "markdown",
    css: "css", scss: "scss",
    html: "html", xml: "xml",
    py: "python", rb: "ruby",
    go: "go", rs: "rust",
    java: "java", kt: "kotlin",
    sh: "shell", bash: "shell",
    yaml: "yaml", yml: "yaml",
    toml: "toml", sql: "sql",
    prisma: "prisma", graphql: "graphql",
    dockerfile: "dockerfile",
    env: "ini", gitignore: "ini",
    lock: "yaml",
  };
  return map[ext] ?? "plaintext";
}

type FileTreeItem = WorkspaceExplorerItem & { id: string };

function buildFlatTree(
  items: Record<string, WorkspaceExplorerItem>,
  nodeId = "root",
  depth = 0,
): FileTreeItem[] {
  const node = items[nodeId];
  if (!node) return [];
  const result: FileTreeItem[] = [];
  if (nodeId !== "root") {
    result.push({ ...node, id: nodeId });
  }
  if (node.children) {
    for (const child of node.children) {
      result.push(...buildFlatTree(items, child as string, depth + 1));
    }
  }
  return result;
}

function FileTree({
  items,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  items: Record<string, WorkspaceExplorerItem>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  function renderNode(nodeId: string, depth: number): React.ReactNode {
    const node = items[nodeId];
    if (!node) return null;
    const isFolder = (node.children?.length ?? 0) > 0;
    const isExpanded = expandedIds.has(nodeId);
    const isSelected = selectedId === nodeId;
    const isSynStatus = nodeId.startsWith("syn:");
    const label = node.name;
    const indent = depth * 14;

    return (
      <React.Fragment key={nodeId}>
        <button
          type="button"
          onClick={() => {
            if (isFolder) onToggle(nodeId);
            else onSelect(nodeId);
          }}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs transition",
            isSelected
              ? "bg-primary/10 text-primary"
              : isSynStatus
                ? "cursor-default text-muted-foreground/60"
                : "text-foreground/80 hover:bg-muted",
          )}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {isFolder ? (
            isExpanded ? (
              <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )
          ) : (
            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{label}</span>
        </button>
        {isFolder && isExpanded && node.children
          ? node.children.map((child) => renderNode(child as string, depth + 1))
          : null}
      </React.Fragment>
    );
  }

  const root = items["root"];
  if (!root?.children) return null;

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {root.children.map((child) => renderNode(child as string, 0))}
    </div>
  );
}

export default function EditorPage({ projectId, projectSlug, projectName }: Props) {
  const router = useRouter();
  const [treeItems, setTreeItems] = React.useState<Record<string, WorkspaceExplorerItem>>({
    root: { name: "repository", children: ["syn:loading"] },
    "syn:loading": { name: "Loading files…" },
  });
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState<string>("");
  const [loadingFile, setLoadingFile] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);
  const editorRef = React.useRef<unknown>(null);

  const selectedPath = selectedFileId ? relativePathFromTreeItemId(selectedFileId) : null;
  const language = selectedPath ? getLanguageFromPath(selectedPath) : "plaintext";

  // Load file tree on mount
  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace-files`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as WorkspaceFilesResponse;
        if (data.paths) {
          const built = filePathsToTreeItems(data.paths, data.rootLabel);
          setTreeItems(built);
          // Auto-expand root children
          const root = built["root"];
          if (root?.children) {
            setExpandedIds(new Set(root.children as string[]));
          }
        }
      } catch {
        /* ignore */
      }
    }
    void load();
  }, [projectId]);

  // Load file content when selection changes
  React.useEffect(() => {
    if (!selectedFileId || !selectedPath) return;
    const node = treeItems[selectedFileId];
    if (!node || (node.children?.length ?? 0) > 0) return; // is folder

    setLoadingFile(true);
    setFileContent("");
    setIsDirty(false);
    setSaveStatus("idle");

    const ac = new AbortController();
    fetch(
      `/api/projects/${encodeURIComponent(projectId)}/workspace-selection?path=${encodeURIComponent(selectedPath)}`,
      { signal: ac.signal, cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data: { content?: string | null }) => {
        setFileContent(data.content ?? "");
        setLoadingFile(false);
      })
      .catch(() => {
        if (!ac.signal.aborted) setLoadingFile(false);
      });

    return () => ac.abort();
  }, [selectedFileId, selectedPath, projectId, treeItems]);

  const handleSave = React.useCallback(async () => {
    if (!selectedPath || !isDirty) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace-write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, content: fileContent }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSaveStatus("error");
        setSaveError(data.error ?? "Save failed");
        return;
      }
      setSaveStatus("saved");
      setIsDirty(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setSaveError("Network error");
    }
  }, [selectedPath, isDirty, projectId, fileContent]);

  // Ctrl+S / Cmd+S to save
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  const handleToggle = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const breadcrumbs = selectedPath ? selectedPath.split("/") : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 py-2">
        <button
          type="button"
          onClick={() => void router.push(`/projects/${projectSlug}`)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </button>
        <span className="text-xs font-medium text-foreground">{projectName}</span>
        {breadcrumbs.length > 0 && (
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <ChevronRightIcon className="size-3.5 shrink-0" />
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRightIcon className="size-3 shrink-0 opacity-40" />}
                <span className={i === breadcrumbs.length - 1 ? "font-medium text-foreground" : ""}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || saveStatus === "saving" || !selectedPath}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              saveStatus === "saved"
                ? "bg-green-500/15 text-green-600 dark:text-green-400"
                : saveStatus === "error"
                  ? "bg-destructive/10 text-destructive"
                  : isDirty
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed",
            )}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saveStatus === "saved" ? (
              <CheckIcon className="size-3.5" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-card">
          <div className="border-b border-border/40 px-3 py-2">
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Explorer</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FileTree
              items={treeItems}
              selectedId={selectedFileId}
              onSelect={setSelectedFileId}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          </div>
        </div>

        {/* Editor area */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {!selectedPath ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <FileIcon className="size-10 opacity-20" />
              <p className="text-sm">Select a file from the explorer to start editing</p>
              <p className="text-xs opacity-60">Ctrl+S / ⌘S to save</p>
            </div>
          ) : loadingFile ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              language={language}
              value={fileContent}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                lineNumbersMinChars: 3,
              }}
              onChange={(value) => {
                setFileContent(value ?? "");
                setIsDirty(true);
                setSaveStatus("idle");
              }}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) return { notFound: true };

  const project = await prisma.project.findFirst({
    where: whereProjectBySlugForUser(slug, session.user.id),
    select: { id: true, name: true },
  });
  if (!project) return { notFound: true };

  return {
    props: {
      projectId: project.id,
      projectSlug: slug,
      projectName: project.name,
    },
  };
};
