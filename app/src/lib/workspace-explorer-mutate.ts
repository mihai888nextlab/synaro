/** Join a parent directory path with a new entry name (repo-relative). */
export function joinWorkspacePath(parentDir: string | null, name: string): string | null {
  const clean = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("..") || clean.includes("/")) return null;
  if (!parentDir?.trim()) return clean;
  const parent = parentDir.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!parent || parent.includes("..")) return null;
  return `${parent}/${clean}`;
}

export function replaceWorkspacePathBasename(path: string, newName: string): string | null {
  const clean = newName.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("..") || clean.includes("/")) return null;
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!normalized || normalized.includes("..")) return null;
  const slash = normalized.lastIndexOf("/");
  if (slash === -1) return clean;
  return `${normalized.slice(0, slash)}/${clean}`;
}

async function mutateWorkspace(
  projectId: string,
  body: Record<string, string | undefined>,
): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace-mutate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(data.detail ?? data.error ?? `Request failed (${res.status})`);
  }
}

export async function createWorkspaceFile(
  projectId: string,
  parentDir: string | null,
  fileName: string,
): Promise<string> {
  const path = joinWorkspacePath(parentDir, fileName);
  if (!path) throw new Error("Invalid file name");
  await mutateWorkspace(projectId, { action: "createFile", path, content: "" });
  return path;
}

export async function createWorkspaceFolder(
  projectId: string,
  parentDir: string | null,
  folderName: string,
): Promise<string> {
  const path = joinWorkspacePath(parentDir, folderName);
  if (!path) throw new Error("Invalid folder name");
  await mutateWorkspace(projectId, { action: "createFolder", path });
  return path;
}

export async function deleteWorkspaceEntry(projectId: string, path: string): Promise<void> {
  await mutateWorkspace(projectId, { action: "delete", path });
}

export async function renameWorkspaceEntry(
  projectId: string,
  fromPath: string,
  newName: string,
): Promise<string> {
  const toPath = replaceWorkspacePathBasename(fromPath, newName);
  if (!toPath) throw new Error("Invalid new name");
  await mutateWorkspace(projectId, { action: "rename", from: fromPath, to: toPath });
  return toPath;
}
