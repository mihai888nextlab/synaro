import type { Project } from "@prisma/client";

export function serializeProject(row: Project) {
  return {
    project_id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    environment_status: row.environmentStatus,
    repository_location: row.repositoryLocation,
    clone_repository_url: row.cloneRepositoryUrl,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeApiKey(row: {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}) {
  return {
    key_id: row.id,
    name: row.name,
    key_prefix: row.keyPrefix,
    created_at: row.createdAt.toISOString(),
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    revoked_at: row.revokedAt?.toISOString() ?? null,
  };
}

/** Shallow-recursive camelCase → snake_case for upstream JSON payloads. */
export function toSnakeCaseJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toSnakeCaseJson);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const snake = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
    out[snake] = toSnakeCaseJson(val);
  }
  return out;
}
