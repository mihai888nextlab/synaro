/** Turn a URL segment like `peak-athletic` into display text for UI and breadcrumbs. */
export function humanizeProjectSlug(slug: string): string {
  if (!slug || typeof slug !== "string") return "Project";
  try {
    const decoded = decodeURIComponent(slug);
    return decoded
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return slug;
  }
}

/** Produce a URL-safe slug base from a project title (may need uniqueness suffix from the caller). */
export function slugifyProjectName(name: string): string {
  const raw = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return raw || "project";
}
