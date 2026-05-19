import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

export type GithubUserRepoRow = {
  id: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  private: boolean;
  updatedAt: string | null;
};

type OkBody = { repos: GithubUserRepoRow[]; hasMore: boolean; page: number };
type ErrBody = { error: string; code?: string; hint?: string };

const PER_PAGE = 30;
const UA = "SynaroApp/1.0 (GitHub import)";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkBody | ErrBody>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  if (!account?.access_token) {
    return res.status(403).json({
      error: "GitHub is not connected to this account.",
      code: "GITHUB_NOT_LINKED",
      hint: "Open Settings → Profile and use “Connect GitHub”.",
    });
  }

  const rawPage = typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 20) : 1;

  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");

  let gh: Response;
  try {
    gh = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": UA,
      },
    });
  } catch {
    return res.status(502).json({ error: "Could not reach GitHub." });
  }

  const text = await gh.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!gh.ok) {
    const msg =
      json && typeof json === "object" && json !== null && "message" in json
        ? String((json as { message?: unknown }).message)
        : text || gh.statusText;
    if (gh.status === 401 || gh.status === 403) {
      return res.status(502).json({
        error: msg || "GitHub rejected this token.",
        code: "GITHUB_AUTH_FAILED",
        hint: "Disconnect GitHub under Settings → Profile, then connect again so Synaro can request repository access.",
      });
    }
    return res.status(502).json({ error: msg || `GitHub error (${gh.status}).` });
  }

  if (!Array.isArray(json)) {
    return res.status(502).json({ error: "Unexpected response from GitHub." });
  }

  const repos: GithubUserRepoRow[] = json.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: typeof r.id === "number" ? r.id : 0,
      fullName: typeof r.full_name === "string" ? r.full_name : "",
      htmlUrl: typeof r.html_url === "string" ? r.html_url : "",
      description: typeof r.description === "string" ? r.description : null,
      private: r.private === true,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
    };
  });

  const filtered = repos.filter((r) => r.fullName && r.htmlUrl);
  const hasMore = filtered.length >= PER_PAGE;

  return res.status(200).json({ repos: filtered, hasMore, page });
}
