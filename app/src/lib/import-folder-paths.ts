/**
 * Normalize user-supplied relative paths (folder upload / drag-drop).
 * Rejects path traversal and NUL bytes.
 */
export function sanitizeUploadRelativePath(p: string): string | null {
  const t = p.trim().replace(/^\.\/+/, "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!t || t.includes("\0")) return null;
  for (const seg of t.split("/")) {
    if (seg === "" || seg === "." || seg === "..") return null;
  }
  return t;
}

/**
 * When every file lives under the same top-level folder (e.g. `my-app/...`), strip that folder
 * so the archive root matches a Git clone (`package.json` at workspace root).
 */
export function stripSharedRootPath(paths: string[]): string[] {
  if (paths.length === 0) return [];
  const norm = paths.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, ""));
  if (norm.some((p) => !p)) return norm;
  const firstSeg = norm[0]!.split("/")[0]!;
  if (!firstSeg) return norm;
  const under = norm.every((p) => p === firstSeg || p.startsWith(`${firstSeg}/`));
  if (!under) return norm;
  const rest = norm
    .map((p) => (p === firstSeg ? "" : p.slice(firstSeg.length + 1)))
    .filter((p) => p.length > 0);
  return rest.length > 0 ? rest : norm;
}

/** Default project title when importing a folder (common top-level directory name). */
export function defaultFolderImportName(paths: string[]): string {
  if (paths.length === 0) return "Imported project";
  const norm = paths.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, "")).filter((p) => p.length > 0);
  if (norm.length === 0) return "Imported project";
  const firstSeg = norm[0]!.split("/")[0]!;
  if (firstSeg && norm.every((p) => p === firstSeg || p.startsWith(`${firstSeg}/`))) return firstSeg;
  const leaf = norm[0]!.split("/").pop() ?? "Imported project";
  return leaf.replace(/\.[^/.]+$/, "") || "Imported project";
}
