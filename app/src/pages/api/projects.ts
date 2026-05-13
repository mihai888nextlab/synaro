import { randomBytes } from "node:crypto";

import type { EnvironmentStatus, Project } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { projectRowToCardModel, projectRowToCardModelWithStack } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { resolveProjectDockerImage } from "@/lib/project-docker-images";
import { slugifyProjectName } from "@/lib/project-slug";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

type EnvServiceRow = {
  id: string;
  projectId: string;
  status: string;
  port?: number | null;
  image?: string;
  containerId?: string | null;
  updatedAt?: string | Date;
};

function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
}

/** Node/undici often throws `TypeError: fetch failed` with no detail when upstream is down. */
function isUnreachableUpstreamError(message: string): boolean {
  return /fetch failed|failed to fetch|econnrefused|econnreset|enotfound|network\s*error/i.test(message);
}

function formatEnvironmentProvisionFailure(err: unknown): string {
  const chain =
    err instanceof Error
      ? [err.message, err.cause instanceof Error ? err.cause.message : String(err.cause ?? "")]
          .filter(Boolean)
          .join(" ")
      : String(err);
  const base = environmentServiceBaseUrl();
  if (isUnreachableUpstreamError(chain)) {
    return `Could not reach the environment service at ${base}. From the repo root run: docker compose up -d postgresql-env environment-service`;
  }
  return err instanceof Error ? err.message : String(err);
}

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

async function allocateUniqueSlug(name: string): Promise<string> {
  const base = slugifyProjectName(name);
  for (let i = 0; i < 64; i++) {
    const suffix = i === 0 ? "" : `-${randomBytes(2).toString("hex")}`;
    const slug = `${base}${suffix}`.slice(0, 64);
    const clash = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) return slug;
  }
  throw new Error("Could not allocate a unique slug");
}

async function provisionEnvironment(projectId: string, image: string): Promise<EnvServiceRow> {
  const base = environmentServiceBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, image }),
    });
  } catch (err) {
    throw new Error(formatEnvironmentProvisionFailure(err));
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail =
      json && typeof json === "object" && json !== null && "detail" in json
        ? String((json as { detail?: unknown }).detail)
        : text;
    throw new Error(`Environment service ${res.status}: ${detail || res.statusText}`);
  }
  if (!json || typeof json !== "object") throw new Error("Invalid environment service response");
  return json as EnvServiceRow;
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
      const rows = await prisma.project.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      const live = await latestEnvironmentSummariesByProjectId(rows.map((r) => r.id));
      const cards = rows.map((row, i) => {
        const s = live[row.id];
        const st = s ? parseEnvironmentStatusFromService(s.status) : null;
        const merged = st ? { ...row, environmentStatus: st } : row;
        return projectRowToCardModel(merged, i);
      });
      res.status(200).json({ projects: cards });
      return;
    }

    if (req.method === "POST") {
      const body = req.body as { name?: unknown; description?: unknown; dockerImage?: unknown };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
      const dockerRaw = typeof body.dockerImage === "string" ? body.dockerImage : "automatic";

      if (!name || name.length > 120) {
        res.status(400).json({ error: "Invalid project name" });
        return;
      }

      const slug = await allocateUniqueSlug(name);
      const image = resolveProjectDockerImage(dockerRaw);

      let project: Project = await prisma.project.create({
        data: {
          slug,
          name,
          description: description || null,
          userId,
          environmentStatus: "PROVISIONING",
        },
      });

      try {
        const env = await provisionEnvironment(project.id, image);
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
        const card = projectRowToCardModelWithStack(project, 0, image);
        // Project row is persisted — return 201 so the client treats this as success, not a transport error.
        res.status(201).json({
          project: card,
          environmentWarning: formatEnvironmentProvisionFailure(e),
        });
        return;
      }

      const card = projectRowToCardModelWithStack(project, 0, image);
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
