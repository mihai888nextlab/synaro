import type { EnvironmentStatus, Project } from "@prisma/client";
import busboy from "busboy";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { pack } from "tar-stream";

import { allocateUniqueProjectSlug } from "@/lib/allocate-project-slug";
import {
  defaultFolderImportName,
  sanitizeUploadRelativePath,
  stripSharedRootPath,
} from "@/lib/import-folder-paths";
import { projectRowToCardModelWithStack } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import {
  formatEnvironmentProvisionFailure,
  provisionProjectEnvironment,
  uploadWorkspaceTarToEnvironment,
} from "@/lib/provision-project-environment";
import { resolveProjectDockerImage } from "@/lib/project-docker-images";
import { authOptions } from "@/lib/next-auth-options";

export const config = {
  api: { bodyParser: false },
};

const MAX_FILES = 4000;
const MAX_TOTAL_BYTES = 45 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function previewHostBase(): string {
  const fromEnv = process.env.SYNARO_PREVIEW_HOST?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost";
}

function parseEnvStatus(s: string): EnvironmentStatus {
  const allowed: EnvironmentStatus[] = ["INACTIVE", "PROVISIONING", "RUNNING", "STOPPED", "ERROR"];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : "ERROR";
}

type ParsedMultipart = {
  name: string;
  description: string;
  dockerImage: string;
  files: Map<string, Buffer>;
};

function parseFolderImportMultipart(req: NextApiRequest): Promise<ParsedMultipart> {
  return new Promise((resolve, reject) => {
    const fields = { name: "", description: "", dockerImage: "automatic" };
    const files = new Map<string, Buffer>();
    let totalBytes = 0;

    const bb = busboy({
      headers: req.headers,
      limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
    });

    bb.on("field", (name, val) => {
      const s = typeof val === "string" ? val : String(val);
      if (name === "name") fields.name = s.trim();
      else if (name === "description") fields.description = s.trim().slice(0, 2000);
      else if (name === "dockerImage") fields.dockerImage = s.trim() || "automatic";
    });

    bb.on("file", (name, file, info) => {
      if (name !== "files") {
        file.resume();
        return;
      }
      const rawName = info.filename || "unnamed";
      const chunks: Buffer[] = [];
      file.on("data", (d: Buffer) => {
        totalBytes += d.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          file.resume();
          reject(new Error("UPLOAD_TOO_LARGE"));
        } else {
          chunks.push(d);
        }
      });
      file.on("limit", () => {
        reject(new Error("FILE_TOO_LARGE"));
      });
      file.on("error", reject);
      file.on("end", () => {
        files.set(rawName, Buffer.concat(chunks));
      });
    });

    bb.on("error", reject);
    bb.on("finish", () => {
      resolve({
        name: fields.name,
        description: fields.description,
        dockerImage: fields.dockerImage,
        files,
      });
    });

    req.on("aborted", () => reject(new Error("REQUEST_ABORTED")));
    req.pipe(bb);
  });
}

async function buildTarBuffer(entries: { path: string; buffer: Buffer }[]): Promise<Buffer> {
  const p = pack();
  const chunks: Buffer[] = [];
  const ended = new Promise<Buffer>((resolve, reject) => {
    p.on("data", (c: Buffer) => chunks.push(c));
    p.on("end", () => resolve(Buffer.concat(chunks)));
    p.on("error", reject);
  });
  for (const e of entries) {
    await new Promise<void>((res, rej) => {
      p.entry({ name: e.path, size: e.buffer.length }, e.buffer, (err) => {
        if (err) rej(err);
        else res();
      });
    });
  }
  p.finalize();
  return ended;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end();
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let parsed: ParsedMultipart;
    try {
      parsed = await parseFolderImportMultipart(req);
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === "UPLOAD_TOO_LARGE") {
        res.status(413).json({ error: "Upload too large (limit ~45 MB total)." });
        return;
      }
      if (code === "FILE_TOO_LARGE") {
        res.status(413).json({ error: `A single file exceeded ${MAX_FILE_BYTES / (1024 * 1024)} MB.` });
        return;
      }
      if (code === "REQUEST_ABORTED") {
        res.status(499).json({ error: "Upload cancelled." });
        return;
      }
      throw e;
    }

    const rawPaths = [...parsed.files.keys()].sort((a, b) => a.localeCompare(b));
    if (rawPaths.length === 0) {
      res.status(400).json({ error: "No files in upload." });
      return;
    }

    const stripped = stripSharedRootPath(rawPaths);
    const tarEntries: { path: string; buffer: Buffer }[] = [];
    for (let i = 0; i < rawPaths.length; i++) {
      const rel = stripped[i] ?? rawPaths[i]!;
      const safe = sanitizeUploadRelativePath(rel);
      if (!safe) continue;
      const buf = parsed.files.get(rawPaths[i]!);
      if (!buf?.length) continue;
      tarEntries.push({ path: safe, buffer: buf });
    }

    if (tarEntries.length === 0) {
      res.status(400).json({ error: "No valid file paths after sanitization." });
      return;
    }

    let name = parsed.name.trim();
    if (!name) name = defaultFolderImportName(rawPaths);
    if (!name || name.length > 120) {
      res.status(400).json({ error: "Invalid project name" });
      return;
    }

    const description = parsed.description.trim().slice(0, 2000);
    const image = resolveProjectDockerImage(parsed.dockerImage);

    const slug = await allocateUniqueProjectSlug(prisma, name);
    let project: Project = await prisma.project.create({
      data: {
        slug,
        name,
        description: description || null,
        userId,
        environmentStatus: "PROVISIONING",
        cloneRepositoryUrl: null,
      },
    });

    try {
      const env = await provisionProjectEnvironment(project.id, image, {});
      const tar = await buildTarBuffer(tarEntries);
      await uploadWorkspaceTarToEnvironment(env.id, tar);

      const nextStatus = parseEnvStatus(env.status);
      const base = previewHostBase();
      const port = typeof env.port === "number" ? env.port : null;
      const repositoryLocation = nextStatus === "RUNNING" && port != null ? `${base}:${port}` : null;

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
      res.status(201).json({
        project: card,
        environmentWarning: formatEnvironmentProvisionFailure(e),
      });
      return;
    }

    const card = projectRowToCardModelWithStack(project, 0, image, { viewerUserId: userId });
    res.status(201).json({ project: card });
  } catch (err) {
    console.error("[api/projects/import-folder]", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Internal server error",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}
