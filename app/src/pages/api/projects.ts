import type { EnvironmentStatus, Project } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { allocateUniqueProjectSlug } from "@/lib/allocate-project-slug";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import {
  defaultProjectNameFromGithubUrl,
  normalizeGithubRepoUrl,
} from "@/lib/github-repo-url";
import { projectRowToCardModelWithStack } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import {
  formatEnvironmentProvisionFailure,
  provisionProjectEnvironment,
} from "@/lib/provision-project-environment";
import { resolveProjectDockerImage } from "@/lib/project-docker-images";
import { authOptions } from "@/lib/next-auth-options";
import { getUserProjectCardsWithRows } from "@/lib/user-project-cards";

/** Base URL the browser uses to reach published container ports (host machine). */
function previewHostBase(): string {
  const fromEnv = process.env.SYNARO_PREVIEW_HOST?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost";
}

function parseEnvStatus(s: string): EnvironmentStatus {
  const allowed: EnvironmentStatus[] = [
    "INACTIVE",
    "PROVISIONING",
    "RUNNING",
    "STOPPED",
    "ERROR",
  ];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : "ERROR";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const { cards } = await getUserProjectCardsWithRows(userId);
      res.status(200).json({ projects: cards });
      return;
    }

    if (req.method === "POST") {
      const body = req.body as {
        name?: unknown;
        description?: unknown;
        dockerImage?: unknown;
        repositoryUrl?: unknown;
      };
      const repositoryUrlRaw =
        typeof body.repositoryUrl === "string" ? body.repositoryUrl.trim() : "";
      let cloneRepositoryUrl: string | null = null;
      if (repositoryUrlRaw) {
        cloneRepositoryUrl = normalizeGithubRepoUrl(repositoryUrlRaw);
        if (!cloneRepositoryUrl) {
          res.status(400).json({ error: "Invalid GitHub repository URL (use https://github.com/owner/repo)." });
          return;
        }
      }

      let name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name && cloneRepositoryUrl) {
        name = defaultProjectNameFromGithubUrl(cloneRepositoryUrl);
      }
      const description =
        typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
      const dockerRaw = typeof body.dockerImage === "string" ? body.dockerImage : "automatic";

      if (!name || name.length > 120) {
        res.status(400).json({ error: "Invalid project name" });
        return;
      }

      const slug = await allocateUniqueProjectSlug(prisma, name);
      const image = resolveProjectDockerImage(dockerRaw);

      let project: Project = await prisma.project.create({
        data: {
          slug,
          name,
          description: description || null,
          userId,
          environmentStatus: "PROVISIONING",
          cloneRepositoryUrl,
        },
      });

      try {
        const gitAccessToken = cloneRepositoryUrl ? await getGithubAccessTokenForUser(userId) : null;
        const env = await provisionProjectEnvironment(project.id, image, {
          gitRemoteUrl: cloneRepositoryUrl,
          gitAccessToken: gitAccessToken ?? undefined,
        });
        const nextStatus = parseEnvStatus(env.status);
        const base = previewHostBase();
        const port = typeof env.port === "number" ? env.port : null;
        const repositoryLocation =
          nextStatus === "RUNNING" && port != null ? `${base}:${port}` : null;

        project = await prisma.project.update({
          where: { id: project.id },
          data: {
            environmentStatus: nextStatus,
            repositoryLocation: repositoryLocation ?? project.repositoryLocation,
          },
        });
      } catch (e) {
        await prisma.project.update({
          where: { id: project.id },
          data: { environmentStatus: "ERROR" },
        });
        project = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
        const card = projectRowToCardModelWithStack(project, 0, image, { viewerUserId: userId });
        // Project row is persisted — return 201 so the client treats this as success, not a transport error.
        res.status(201).json({
          project: card,
          environmentWarning: formatEnvironmentProvisionFailure(e),
        });
        return;
      }

      const card = projectRowToCardModelWithStack(project, 0, image, { viewerUserId: userId });
      res.status(201).json({ project: card });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).end();
  } catch (err) {
    console.error("[api/projects]", err);
    const message = err instanceof Error ? err.message : String(err);
    const hint =
      message.includes("slug") || message.includes("Project")
        ? "Database schema may be out of date. From the app directory run: npx prisma migrate deploy"
        : undefined;
    res.status(500).json({
      error: "Internal server error",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
      hint,
    });
  }
}
