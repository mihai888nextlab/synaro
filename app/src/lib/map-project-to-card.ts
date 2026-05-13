import type { Project } from "@prisma/client";

import type {
  SynaroProjectCardIconKey,
  SynaroProjectCardModel,
  SynaroProjectEnvironmentStatus,
} from "@/components/ui/project-cards-grid";
import { formatShortRelativeTime } from "@/lib/relative-time";

const ICON_CYCLE: SynaroProjectCardIconKey[] = ["brain", "zap", "sparkles"];

function stackLine(row: Project): string {
  if (row.repositoryLocation?.startsWith("http")) {
    try {
      const u = new URL(row.repositoryLocation);
      return `Preview ${u.host}`;
    } catch {
      return "Preview URL";
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
export function projectRowToCardModel(row: Project, index: number): SynaroProjectCardModel {
  const icon = ICON_CYCLE[Math.abs(index) % ICON_CYCLE.length]!;
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    description: row.description ?? "",
    stack: stackLine(row),
    updatedRelative: formatShortRelativeTime(row.updatedAt),
    environmentStatus: row.environmentStatus as SynaroProjectEnvironmentStatus,
    icon,
  };
}

/** Card model with optional stack line derived from the chosen Docker image (new project flow). */
export function projectRowToCardModelWithStack(
  row: Project,
  index: number,
  dockerImage?: string | null,
): SynaroProjectCardModel {
  const base = projectRowToCardModel(row, index);
  if (!dockerImage) return base;
  return { ...base, stack: stackFromDockerImage(dockerImage) };
}
