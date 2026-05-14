import type { NextApiResponse } from "next";

/** Avoid browser/CDN 304 caching of per-user, mutable workspace data. */
export function applyDynamicApiNoCacheHeaders(res: NextApiResponse): void {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}
