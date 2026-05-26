/** Canonical https://github.com/owner/repo.git clone URL (no credentials). */
export function toPublicGitCloneUrl(normalizedRepoHttps: string): string {
  const u = new URL(normalizedRepoHttps);
  if (u.hostname === "www.github.com") u.hostname = "github.com";
  const path = u.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
  return `https://github.com${path}.git`;
}

export function toGithubAuthenticatedCloneUrl(normalizedRepoHttps: string, accessToken: string): string {
  const base = toPublicGitCloneUrl(normalizedRepoHttps);
  const u = new URL(base);
  u.username = "x-access-token";
  u.password = accessToken;
  return u.toString();
}
