import type { Project } from "@prisma/client";

import type {
  SynaroProjectCardIconKey,
  SynaroProjectCardModel,
  SynaroProjectEnvironmentStatus,
} from "@/components/ui/project-cards-grid";
import { formatShortRelativeTime } from "@/lib/relative-time";

const ICON_CYCLE: SynaroProjectCardIconKey[] = ["brain", "zap", "sparkles"];

function stackLine(row: Project): string {
  const loc = row.repositoryLocation;
  if (loc?.startsWith("http")) {
    try {
      const u = new URL(loc);
      if (u.hostname === "github.com" || u.hostname === "www.github.com") {
        const p = u.pathname.replace(/^\/+|\/+$/g, "");
        return p ? `GitHub · ${p}` : "GitHub";
      }
      return `Preview ${u.host}${u.port ? `:${u.port}` : ""}`;
    } catch {
      return "Preview URL";
    }
  }
  const clone = row.cloneRepositoryUrl;
  if (clone?.includes("github.com")) {
    try {
      const u = new URL(clone);
      const p = u.pathname.replace(/^\/+|\/+$/g, "");
      return p ? `GitHub · ${p}` : "GitHub";
    } catch {
      return "GitHub";
    }
  }
  return "Workspace";
}

function stackFromDockerImage(image: string): string {
  if (image.includes("node")) return "Node.js";
  if (image.includes("python")) return "Python";
  if (image.includes("golang") || image.startsWith("go")) return "Go";
  if (image.includes("nginx")) return "Nginx";
  if (image.includes("ubuntu")) return "Ubuntu";
  return image.split(":")[0] ?? "Docker";
}

/** Maps a Prisma `Project` row to the card grid model (JSON-serializable). */
export function projectRowToCardModel(
  row: Project,
  index: number,
  opts?: { viewerUserId?: string },
): SynaroProjectCardModel {
  const icon = ICON_CYCLE[Math.abs(index) % ICON_CYCLE.length]!;
  const model: SynaroProjectCardModel = {
    id: row.id,
    slug: row.slug,
    title: row.name,
    description: row.description ?? "",
    stack: stackLine(row),
    updatedRelative: formatShortRelativeTime(row.updatedAt),
    environmentStatus: row.environmentStatus as SynaroProjectEnvironmentStatus,
    icon,
  };
  if (opts?.viewerUserId != null) {
    model.viewerCanDelete = row.userId === opts.viewerUserId;
  }
  return model;
}

/** Card model with optional stack line derived from the chosen Docker image (new project flow). */
export function projectRowToCardModelWithStack(
  row: Project,
  index: number,
  dockerImage?: string | null,
  opts?: { viewerUserId?: string },
): SynaroProjectCardModel {
  const base = projectRowToCardModel(row, index, opts);
  if (!dockerImage) return base;
  return { ...base, stack: stackFromDockerImage(dockerImage) };
}
