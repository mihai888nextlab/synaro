export const SITE_NAME = "Synaro";

export const DEFAULT_TITLE = "Synaro";

export const DEFAULT_DESCRIPTION =
  "Transform ideas into running software — instantly. AI scaffolding, Docker workspaces, and agents in one platform.";

/** Public site origin (no trailing slash). */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://synaro.tech";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalized}`;
}

export function pageTitle(title?: string): string {
  if (!title || title === SITE_NAME) return DEFAULT_TITLE;
  return `${title} · ${SITE_NAME}`;
}
