import type { EnvironmentStatus } from "@prisma/client";

function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
}

export type RemoteEnvironmentSummary = {
  environmentId: string;
  projectId: string;
  /** Raw status from environment-service DB. */
  status: string;
  image: string | null;
  port: number | null;
  containerId: string | null;
  updatedAt: string;
};

export function parseEnvironmentStatusFromService(s: string): EnvironmentStatus | null {
  const allowed: EnvironmentStatus[] = [
    "INACTIVE",
    "PROVISIONING",
    "RUNNING",
    "STOPPED",
    "ERROR",
  ];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : null;
}

function parseRowToSummary(row: object): RemoteEnvironmentSummary | null {
  const r = row as Record<string, unknown>;
  const id = r.id;
  const projectId = r.projectId;
  if (typeof id !== "string" || typeof projectId !== "string") return null;
  const status = typeof r.status === "string" ? r.status : "UNKNOWN";
  const image = typeof r.image === "string" ? r.image : null;
  const port = typeof r.port === "number" ? r.port : r.port === null ? null : null;
  const containerId = typeof r.containerId === "string" ? r.containerId : null;
  let updatedAt = "";
  if (typeof r.updatedAt === "string") updatedAt = r.updatedAt;
  else if (r.updatedAt instanceof Date) updatedAt = r.updatedAt.toISOString();
  return {
    environmentId: id,
    projectId,
    status,
    image,
    port,
    containerId,
    updatedAt,
  };
}

/**
 * Latest environment row per project from environment-service (API returns newest first per project when filtered;
 * unfiltered list is globally newest-first — we still take first matching projectId).
 */
export async function latestEnvironmentSummariesByProjectId(
  projectIds: string[],
): Promise<Partial<Record<string, RemoteEnvironmentSummary>>> {
  if (projectIds.length === 0) return {};
  const base = environmentServiceBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/environments`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return {};
  }
  if (!res.ok) return {};

  let list: unknown;
  try {
    list = await res.json();
  } catch {
    return {};
  }
  if (!Array.isArray(list)) return {};

  const idSet = new Set(projectIds);
  const out: Partial<Record<string, RemoteEnvironmentSummary>> = {};

  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const summary = parseRowToSummary(row as object);
    if (!summary || !idSet.has(summary.projectId)) continue;
    if (out[summary.projectId] !== undefined) continue;
    out[summary.projectId] = summary;
  }

  return out;
}

export async function latestEnvironmentStatusByProjectId(
  projectIds: string[],
): Promise<Partial<Record<string, EnvironmentStatus>>> {
  const sum = await latestEnvironmentSummariesByProjectId(projectIds);
  const out: Partial<Record<string, EnvironmentStatus>> = {};
  for (const [pid, s] of Object.entries(sum)) {
    if (!s) continue;
    const p = parseEnvironmentStatusFromService(s.status);
    if (p) out[pid] = p;
  }
  return out;
}
