import { siteUrl } from "@/lib/seo/site-metadata";

export type OgType = "site" | "doc" | "project" | "agent" | "invite";

/** Bump when OG artwork/layout changes to refresh social caches. */
export const OG_IMAGE_VERSION = "1";

export function buildOgImageUrl(type: OgType, params?: Record<string, string | undefined>): string {
  const url = new URL("/api/og", siteUrl());
  url.searchParams.set("type", type);
  url.searchParams.set("v", OG_IMAGE_VERSION);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.href;
}
