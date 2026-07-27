/**
 * Admin gate for the demo dashboard. There is no role column — admins are an email allowlist supplied
 * via the ADMIN_EMAILS env var (comma-separated). Keeps this migration-free for the demo timeline.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
