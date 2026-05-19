/**
 * Normalize a user-pasted GitHub repo URL to https://github.com/{owner}/{repo} (no .git, no trailing slash).
 */
export function normalizeGithubRepoUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return `https://github.com/${owner}/${repo}`;
  } catch {
    return null;
  }
}

/** Default project title: GitHub repo name only (last path segment). */
export function defaultProjectNameFromGithubUrl(normalizedUrl: string): string {
  try {
    const parts = new URL(normalizedUrl).pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[1] ?? "Imported repo";
    return parts[0] ?? "Imported repo";
  } catch {
    return "Imported repo";
  }
}

/** HTTPS .git URL suitable for `git clone` (no auth). */
export function toPublicGitCloneUrl(normalizedRepoUrl: string): string {
  const u = new URL(normalizedRepoUrl);
  const path = u.pathname.replace(/\.git$/i, "").replace(/\/+$/, "");
  return `https://github.com${path}.git`;
}

/** Authenticated clone URL for GitHub using an OAuth access token (private repos). */
export function toGithubAuthenticatedCloneUrl(normalizedRepoUrl: string, accessToken: string): string {
  const clone = toPublicGitCloneUrl(normalizedRepoUrl);
  const u = new URL(clone);
  u.username = "x-access-token";
  u.password = accessToken;
  return u.toString();
}

/** `{ owner, repo }` for GitHub REST when `normalizedGithubRepoUrl` is `https://github.com/owner/repo`. */
export function parseGithubOwnerRepo(normalizedGithubRepoUrl: string): { owner: string; repo: string } | null {
  const n = normalizeGithubRepoUrl(normalizedGithubRepoUrl);
  if (!n) return null;
  try {
    const parts = new URL(n).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}
