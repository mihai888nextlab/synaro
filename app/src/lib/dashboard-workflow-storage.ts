/** Keys and helpers for persisting dashboard navigation and project workspace state in localStorage. */

const PREFIX = "synaro.workflow.";

export const WORKFLOW_STORAGE_KEYS = {
  lastProjectsPath: `${PREFIX}lastProjectsPath`,
  /** @deprecated Migrated to {@link WORKFLOW_STORAGE_KEYS.lastProjectsPath}. */
  lastProjectSlug: `${PREFIX}lastProjectSlug`,
  projectTab: (slug: string) => `${PREFIX}tab.${slug}`,
  terminalScrollback: (projectId: string) => `${PREFIX}terminal.${projectId}`,
  /** Expanded headless-tree item ids for the project workspace file explorer. */
  workspaceTreeExpanded: (projectId: string) => `${PREFIX}treeExpanded.${projectId}`,
} as const;

export type ProjectWorkspaceTab = "tree" | "chat" | "terminal" | "deployments";

const TAB_VALUES: ProjectWorkspaceTab[] = ["chat", "tree", "terminal", "deployments"];

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Allowed projects-area paths for sidebar restore (list, workspace, analytics, etc.). */
export function normalizeProjectsPath(path: string): string | null {
  const pathname = path.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!pathname) return null;
  if (pathname === "/projects") return "/projects";
  if (pathname.startsWith("/projects/invite/")) return null;
  if (/^\/projects\/[^/]+(\/.*)?$/.test(pathname)) return pathname;
  return null;
}

export function readLastProjectsPath(): string | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.lastProjectsPath);
    const normalized = raw ? normalizeProjectsPath(raw) : null;
    if (normalized) return normalized;

    const legacySlug = window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.lastProjectSlug);
    if (!legacySlug?.trim()) return null;
    const migrated = normalizeProjectsPath(`/projects/${legacySlug.trim()}`);
    if (!migrated) return null;
    window.localStorage.setItem(WORKFLOW_STORAGE_KEYS.lastProjectsPath, migrated);
    window.localStorage.removeItem(WORKFLOW_STORAGE_KEYS.lastProjectSlug);
    return migrated;
  } catch {
    return null;
  }
}

export function writeLastProjectsPath(path: string): void {
  if (!canUseStorage()) return;
  const normalized = normalizeProjectsPath(path);
  if (!normalized) return;
  try {
    window.localStorage.setItem(WORKFLOW_STORAGE_KEYS.lastProjectsPath, normalized);
  } catch {
    /* quota / private mode */
  }
}

export function getProjectsNavHref(): string {
  return readLastProjectsPath() ?? "/projects";
}

export function readProjectTab(slug: string): ProjectWorkspaceTab | null {
  if (!canUseStorage() || !slug.trim()) return null;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.projectTab(slug.trim()));
    if (!raw) return null;
    return TAB_VALUES.includes(raw as ProjectWorkspaceTab) ? (raw as ProjectWorkspaceTab) : null;
  } catch {
    return null;
  }
}

export function writeProjectTab(slug: string, tab: ProjectWorkspaceTab): void {
  if (!canUseStorage() || !slug.trim()) return;
  try {
    window.localStorage.setItem(WORKFLOW_STORAGE_KEYS.projectTab(slug.trim()), tab);
  } catch {
    /* ignore */
  }
}

const MAX_TERMINAL_SCROLLBACK_BYTES = 200_000;

const MAX_WORKSPACE_TREE_EXPANDED_IDS = 400;

/** `null` = nothing stored yet; `[]` = user had everything collapsed. */
export function readWorkspaceTreeExpanded(projectId: string): string[] | null {
  if (!canUseStorage() || !projectId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.workspaceTreeExpanded(projectId.trim()));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((x): x is string => typeof x === "string")
      .slice(0, MAX_WORKSPACE_TREE_EXPANDED_IDS);
  } catch {
    return null;
  }
}

export function writeWorkspaceTreeExpanded(projectId: string, expandedItemIds: string[]): void {
  if (!canUseStorage() || !projectId.trim()) return;
  try {
    const payload = expandedItemIds.slice(0, MAX_WORKSPACE_TREE_EXPANDED_IDS);
    window.localStorage.setItem(
      WORKFLOW_STORAGE_KEYS.workspaceTreeExpanded(projectId.trim()),
      JSON.stringify(payload),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readTerminalScrollback(projectId: string): string | null {
  if (!canUseStorage() || !projectId) return null;
  try {
    return window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.terminalScrollback(projectId));
  } catch {
    return null;
  }
}

export function writeTerminalScrollback(projectId: string, data: string): void {
  if (!canUseStorage() || !projectId) return;
  let payload = data;
  if (payload.length > MAX_TERMINAL_SCROLLBACK_BYTES) {
    payload = payload.slice(payload.length - MAX_TERMINAL_SCROLLBACK_BYTES);
  }
  try {
    if (!payload) {
      window.localStorage.removeItem(WORKFLOW_STORAGE_KEYS.terminalScrollback(projectId));
    } else {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEYS.terminalScrollback(projectId), payload);
    }
  } catch {
    /* ignore */
  }
}

export function clearTerminalScrollback(projectId: string): void {
  if (!canUseStorage() || !projectId) return;
  try {
    window.localStorage.removeItem(WORKFLOW_STORAGE_KEYS.terminalScrollback(projectId));
  } catch {
    /* ignore */
  }
}
