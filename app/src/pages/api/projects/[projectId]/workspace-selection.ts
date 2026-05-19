import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteWorkspaceSelection,
} from "@/lib/environment-service-api";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { parseGithubOwnerRepo } from "@/lib/github-repo-url";
import { applyDynamicApiNoCacheHeaders } from "@/lib/apply-dynamic-api-no-cache";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type {
  WorkspaceSelectionApiResponse,
  WorkspaceSelectionGithubExtras,
} from "@/lib/workspace-selection-types";
import { authOptions } from "@/lib/next-auth-options";

export type { WorkspaceSelectionApiResponse } from "@/lib/workspace-selection-types";

const GH_HEADERS_BASE = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

async function syncProjectStopped(projectId: string) {
  await prisma.project
    .update({
      where: { id: projectId },
      data: { environmentStatus: "STOPPED", repositoryLocation: null },
    })
    .catch(() => {
      /* ignore */
    });
}

async function fetchGithubExtras(
  cloneRepositoryUrl: string | null,
  userId: string,
  filePath: string,
): Promise<WorkspaceSelectionGithubExtras | undefined> {
  const parsed = cloneRepositoryUrl ? parseGithubOwnerRepo(cloneRepositoryUrl) : null;
  if (!parsed) return undefined;

  const token = await getGithubAccessTokenForUser(userId);
  if (!token) return undefined;

  const headers = { ...GH_HEADERS_BASE, Authorization: `Bearer ${token}` } as const;
  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const fileCommits: WorkspaceSelectionGithubExtras["fileCommits"] = [];
  let lastWorkflowRun: WorkspaceSelectionGithubExtras["lastWorkflowRun"] = null;
  const openPullRequests: WorkspaceSelectionGithubExtras["openPullRequests"] = [];

  try {
    const cr = await fetch(
      `${base}/commits?path=${encodeURIComponent(filePath)}&per_page=6`,
      { headers },
    );
    if (cr.ok) {
      const arr = (await cr.json()) as Array<{
        sha: string;
        html_url: string;
        commit: { author: { name: string | null; date: string | null } | null; message: string };
      }>;
      for (const c of arr) {
        const msg = (c.commit.message || "").split("\n")[0] ?? "";
        fileCommits.push({
          shortSha: c.sha.slice(0, 7),
          htmlUrl: c.html_url,
          author: c.commit.author?.name ?? "unknown",
          date: c.commit.author?.date ?? "",
          message: msg,
        });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const wr = await fetch(`${base}/actions/runs?per_page=1`, { headers });
    if (wr.ok) {
      const j = (await wr.json()) as {
        workflow_runs?: Array<{
          name: string;
          status: string;
          conclusion: string | null;
          created_at: string;
          html_url: string;
        }>;
      };
      const run = j.workflow_runs?.[0];
      if (run) {
        lastWorkflowRun = {
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          createdAt: run.created_at,
          htmlUrl: run.html_url,
        };
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const pr = await fetch(`${base}/pulls?state=open&per_page=6`, { headers });
    if (pr.ok) {
      const arr = (await pr.json()) as Array<{
        number: number;
        title: string;
        html_url: string;
        updated_at: string;
      }>;
      for (const p of arr) {
        openPullRequests.push({
          number: p.number,
          title: p.title,
          htmlUrl: p.html_url,
          updatedAt: p.updated_at,
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (fileCommits.length === 0 && !lastWorkflowRun && openPullRequests.length === 0) {
    return undefined;
  }
  return { fileCommits, lastWorkflowRun, openPullRequests };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkspaceSelectionApiResponse | { error: string; detail?: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  applyDynamicApiNoCacheHeaders(res);

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const path = typeof req.query.path === "string" ? req.query.path.trim() : "";

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!projectId || !path) {
    res.status(400).json({ error: "Invalid project id or path" });
    return;
  }

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true, cloneRepositoryUrl: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  try {
    const rows = await fetchEnvironmentsForProject(projectId);
    const active = pickActiveRuntimeEnvironment(rows);
    if (!active?.id) {
      await syncProjectStopped(projectId);
      res.status(409).json({ error: "No active runtime environment" });
      return;
    }

    const remote = await remoteWorkspaceSelection(active.id, path);

    let github: WorkspaceSelectionGithubExtras | undefined;
    try {
      github = await fetchGithubExtras(project.cloneRepositoryUrl, session.user.id, path);
    } catch {
      github = undefined;
    }

    const body: WorkspaceSelectionApiResponse = { ...remote, github };
    res.status(200).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not active")) {
      await syncProjectStopped(projectId);
      res.status(409).json({ error: "Environment is not running", detail: msg });
      return;
    }
    res.status(500).json({ error: "Failed to load workspace selection", detail: msg });
  }
}
