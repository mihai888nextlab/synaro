import { normalizeGithubRepoUrl } from "@/lib/github-repo-url";

const GITHUB_UA = "Synaro/1.0 (GitHub integration)";

export type CreateGithubRepoResult = {
  htmlUrl: string;
  cloneRepositoryUrl: string;
  owner: string;
  repo: string;
};

/** Create a new repository for the authenticated GitHub user. */
export async function createGithubRepository(
  accessToken: string,
  opts: { name: string; private?: boolean; description?: string },
): Promise<CreateGithubRepoResult> {
  const name = opts.name.trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
  if (!name) throw new Error("Invalid repository name");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": GITHUB_UA,
    },
  });
  if (!userRes.ok) {
    throw new Error(
      "GitHub rejected your token. Disconnect and reconnect GitHub under Settings → Profile.",
    );
  }
  const userJson = (await userRes.json()) as { login?: string };
  const login = userJson.login?.trim();
  if (!login) throw new Error("Could not read your GitHub username.");

  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": GITHUB_UA,
    },
    body: JSON.stringify({
      name,
      private: opts.private ?? false,
      description: opts.description?.trim() || undefined,
      auto_init: false,
    }),
  });

  const raw = await res.text();
  let data: { html_url?: string; clone_url?: string; name?: string; full_name?: string; message?: string } = {};
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    /* ignore */
  }

  if (res.status === 422) {
    const msg = String(data.message ?? "");
    if (msg.toLowerCase().includes("already exists")) {
      const htmlUrl = `https://github.com/${login}/${name}`;
      return { htmlUrl, cloneRepositoryUrl: normalizeGithubRepoUrl(htmlUrl)!, owner: login, repo: name };
    }
  }

  if (!res.ok) {
    const msg =
      typeof data.message === "string" && data.message.length > 0
        ? data.message
        : `GitHub API error (${res.status})`;
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(
        `${msg} — reconnect GitHub under Settings → Profile and ensure repository access is granted.`,
      );
    }
    throw new Error(msg);
  }

  const htmlUrl = data.html_url?.trim() ?? `https://github.com/${login}/${name}`;
  const cloneUrl = normalizeGithubRepoUrl(data.html_url ?? htmlUrl);
  if (!cloneUrl) throw new Error("GitHub did not return a repository URL");

  const parts = new URL(cloneUrl).pathname.split("/").filter(Boolean);
  const owner = parts[0] ?? login;
  const repo = parts[1] ?? name;

  return { htmlUrl, cloneRepositoryUrl: cloneUrl, owner, repo };
}
