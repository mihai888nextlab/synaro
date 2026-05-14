/** Headless-tree item shape used by `project-workspace` explorer. */
export type WorkspaceExplorerItem = {
  name: string;
  children?: string[];
};

function dirId(pathFromRoot: string): string {
  return `dir:${pathFromRoot}`;
}

function fileId(pathFromRoot: string): string {
  return `file:${pathFromRoot}`;
}

/**
 * Build a flat id → item map from repo-relative file paths (e.g. `README.md`, `src/index.ts`).
 */
export function filePathsToTreeItems(
  paths: string[],
  rootLabel: string,
): Record<string, WorkspaceExplorerItem> {
  const rootId = "root";
  const normalized = [
    ...new Set(
      paths
        .map((p) => p.replace(/^\.\/+/, "").replace(/\/+$/, ""))
        .filter((p) => p.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const folders = new Set<string>();
  const files = new Set<string>();

  for (const rel of normalized) {
    const segs = rel.split("/").filter(Boolean);
    if (segs.length === 0) continue;
    for (let i = 0; i < segs.length - 1; i++) {
      folders.add(segs.slice(0, i + 1).join("/"));
    }
    files.add(segs.join("/"));
  }

  const items: Record<string, WorkspaceExplorerItem> = {
    [rootId]: { name: rootLabel, children: [] },
  };

  for (const f of folders) {
    const segs = f.split("/").filter(Boolean);
    const name = segs[segs.length - 1] ?? f;
    items[dirId(f)] = { name, children: [] };
  }
  for (const f of files) {
    const segs = f.split("/").filter(Boolean);
    const name = segs[segs.length - 1] ?? f;
    items[fileId(f)] = { name };
  }

  const childIds = new Map<string, Set<string>>();
  function addChild(parent: string, child: string) {
    if (!childIds.has(parent)) childIds.set(parent, new Set());
    childIds.get(parent)!.add(child);
  }

  for (const f of folders) {
    const parentPath = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
    const parentId = parentPath ? dirId(parentPath) : rootId;
    addChild(parentId, dirId(f));
  }
  for (const f of files) {
    const parentPath = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
    const parentId = parentPath ? dirId(parentPath) : rootId;
    addChild(parentId, fileId(f));
  }

  function sortChildIds(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
      const da = a.startsWith("dir:");
      const db = b.startsWith("dir:");
      if (da !== db) return da ? -1 : 1;
      const na = items[a]?.name ?? "";
      const nb = items[b]?.name ?? "";
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    });
  }

  function finalize(id: string): void {
    const ch = childIds.get(id);
    if (!ch || ch.size === 0) {
      const it = items[id];
      if (it && "children" in it && Array.isArray(it.children) && it.children.length === 0) {
        delete it.children;
      }
      return;
    }
    const sorted = sortChildIds([...ch]);
    items[id] = { ...items[id], name: items[id]!.name, children: sorted };
    for (const c of sorted) finalize(c);
  }

  finalize(rootId);

  if (!items[rootId]?.children?.length) {
    const emptyId = "syn:empty-hint";
    items[emptyId] = { name: "No files listed yet (clone may still be running)" };
    items[rootId] = { name: rootLabel, children: [emptyId] };
  }

  return items;
}

/** Relative path for display from a tree item id. */
export function relativePathFromTreeItemId(id: string): string | null {
  if (id === "root" || id.startsWith("syn:")) return null;
  if (id.startsWith("dir:")) return id.slice("dir:".length);
  if (id.startsWith("file:")) return id.slice("file:".length);
  return null;
}
