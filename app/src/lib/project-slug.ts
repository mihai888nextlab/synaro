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
