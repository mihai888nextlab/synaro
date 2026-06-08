import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { authOptions } from "@/lib/next-auth-options";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
} from "@/lib/environment-service-api";
import { environmentServiceBaseUrl } from "@/lib/provision-project-environment";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export const config = {
  api: {
    responseLimit: false,
  },
};

function safeArchiveFilename(slug: string): string {
  const base = slug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "project";
  return `${base}-workspace.tar.gz`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!projectId) {
    res.status(400).json({ error: "Invalid project id" });
    return;
  }

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true, slug: true },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  try {
    const rows = await fetchEnvironmentsForProject(projectId);
    const active = pickActiveRuntimeEnvironment(rows);
    if (!active?.id || active.status !== "RUNNING") {
      res.status(409).json({
        error: "Start the project container before downloading the workspace.",
      });
      return;
    }

    const base = environmentServiceBaseUrl();
    const upstream = await fetch(
      `${base}/api/environments/${encodeURIComponent(active.id)}/workspace-download`,
      { signal: AbortSignal.timeout(300_000) },
    );

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      let message = text || `Export failed (${upstream.status})`;
      try {
        const j = JSON.parse(text) as { error?: string; detail?: string };
        message = [j.error, j.detail].filter(Boolean).join(" — ") || message;
      } catch {
        /* plain text */
      }
      res.status(upstream.status).json({ error: message });
      return;
    }

    if (!upstream.body) {
      res.status(502).json({ error: "Empty response from environment service" });
      return;
    }

    const filename = safeArchiveFilename(project.slug);
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    const nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
    await pipeline(nodeStream, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Download failed" });
  }
}
