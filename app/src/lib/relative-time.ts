/** Compact English relative time for UI (no extra dependencies). */
export function formatShortRelativeTime(from: Date, now = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 8) return `${w}w ago`;
  return from.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
