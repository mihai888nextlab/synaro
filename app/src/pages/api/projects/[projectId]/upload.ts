import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { touchProjectActivity } from "@/lib/project-activity";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteWriteWorkspaceFileBinary,
  remoteWorkspaceSelection,
} from "@/lib/environment-service-api";

// Allow a larger JSON body — an image arrives base64-encoded (~1.33× its byte size).
export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB decoded

/** Normalize a target directory: forward slashes, no `.`/`..` segments, no leading slash. */
function safeDir(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "public/uploads";
  const cleaned = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
  return cleaned || "public/uploads";
}

/** Find a non-colliding path under `dir`: name.ext → name-1.ext → name-2.ext … (falls back to random). */
async function freeWorkspacePath(envId: string, dir: string, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : ""; // includes leading "."
  for (let i = 0; i <= 50; i++) {
    const candidate = i === 0 ? name : `${stem}-${i}${ext}`;
    const path = `${dir}/${candidate}`;
    try {
      const sel = await remoteWorkspaceSelection(envId, path);
      if (sel.kind !== "file" && sel.kind !== "directory") return path; // free
    } catch {
      return path; // couldn't stat — assume free (write will still validate the path)
    }
  }
  const rand = Math.random().toString(36).slice(2, 8);
  return `${dir}/${stem}-${rand}${ext}`;
}

/** Strip directories and unsafe characters; keep a single safe filename with an image extension. */
function safeImageName(raw: string): string | null {
  const base = raw.split(/[\\/]/).pop()?.trim() ?? "";
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return null;
  const stem = base
    .slice(0, base.length - ext.length - 1)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${stem || "image"}.${ext}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { filename, dataBase64, dir } = (req.body ?? {}) as {
    filename?: unknown;
    dataBase64?: unknown;
    dir?: unknown;
  };
  if (typeof filename !== "string" || typeof dataBase64 !== "string" || !dataBase64) {
    return res.status(400).json({ error: "Expected { filename, dataBase64 }." });
  }

  const name = safeImageName(filename);
  if (!name) {
    return res.status(400).json({ error: "Unsupported file type. Use png, jpg, gif, webp, avif, svg or ico." });
  }

  // Accept a bare base64 string or a data: URL; validate size after decoding.
  const b64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  const byteLen = Math.floor((b64.length * 3) / 4);
  if (byteLen > MAX_BYTES) {
    return res.status(413).json({ error: `Image too large (max ${MAX_BYTES / (1024 * 1024)} MB).` });
  }

  const envs = await fetchEnvironmentsForProject(projectId).catch(() => []);
  const env = pickActiveRuntimeEnvironment(envs);
  if (!env || env.status !== "RUNNING") {
    return res.status(409).json({ error: "Start the project container before uploading images." });
  }

  touchProjectActivity(projectId);

  // Default target is public/uploads (web-referenceable); a caller may target any workspace dir.
  const targetDir = safeDir(dir);

  // Never silently overwrite: if the target name already exists, append -1, -2, … so each upload
  // produces a NEW file (uploading two images that happen to share a filename was clobbering one).
  const workspacePath = await freeWorkspacePath(env.id, targetDir, name);
  try {
    await remoteWriteWorkspaceFileBinary(env.id, workspacePath, b64);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }

  // Files under public/ are served at the web root; anywhere else there is no clean public URL.
  const url = workspacePath.startsWith("public/") ? `/${workspacePath.slice("public/".length)}` : null;

  return res.status(200).json({ ok: true, workspacePath, url });
}
