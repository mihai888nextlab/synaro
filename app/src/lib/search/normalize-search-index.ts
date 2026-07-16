import type {
  SearchIndex,
  SearchIndexActivityLog,
  SearchIndexAgent,
  SearchIndexAgentRun,
  SearchIndexProject,
} from "./search-index";

const MAX_TEXT = 500;
const MAX_NAME = 200;

function safeString(value: unknown, max = MAX_TEXT): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().slice(0, max);
  }
  return "";
}

function safeId(value: unknown): string {
  const id = safeString(value, 128);
  return id;
}

function safeIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeSearchProject(raw: unknown): SearchIndexProject | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = safeId(row.id);
  const slug = safeString(row.slug, 128);
  const name = safeString(row.name, MAX_NAME);
  if (!id || !slug || !name) return null;
  return {
    id,
    slug,
    name,
    description: safeString(row.description),
  };
}

export function normalizeSearchAgent(raw: unknown): SearchIndexAgent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = safeId(row.id);
  const name = safeString(row.name, MAX_NAME);
  if (!id || !name) return null;
  return {
    id,
    name,
    description: safeString(row.description),
  };
}

export function normalizeSearchActivityLog(raw: unknown): SearchIndexActivityLog | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = safeId(row.id);
  const action = safeString(row.action, MAX_NAME);
  if (!id || !action) return null;

  const hrefRaw = row.href;
  const href =
    typeof hrefRaw === "string" && hrefRaw.trim().startsWith("/") ? hrefRaw.trim() : null;

  return {
    id,
    action,
    status: safeString(row.status, 32) || "DONE",
    entityName: safeString(row.entityName, MAX_NAME) || "Activity",
    href,
    occurredAt: safeIsoDate(row.occurredAt),
  };
}

export function normalizeSearchAgentRun(raw: unknown): SearchIndexAgentRun | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = safeId(row.id);
  const agentId = safeId(row.agentId);
  const agentName = safeString(row.agentName, MAX_NAME);
  const createdAt = safeIsoDate(row.createdAt);
  if (!id || !agentId || !agentName || !createdAt) return null;

  return {
    id,
    agentId,
    agentName,
    status: safeString(row.status, 32) || "UNKNOWN",
    createdAt,
  };
}

export const EMPTY_SEARCH_INDEX: SearchIndex = {
  projects: [],
  agents: [],
  activityLogs: [],
  agentRuns: [],
};

/** Coerce unknown/partial API payloads into a safe SearchIndex shape. */
export function normalizeSearchIndex(raw: unknown): SearchIndex {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SEARCH_INDEX };

  const data = raw as Record<string, unknown>;

  return {
    projects: Array.isArray(data.projects)
      ? data.projects.map(normalizeSearchProject).filter((row): row is SearchIndexProject => row !== null)
      : [],
    agents: Array.isArray(data.agents)
      ? data.agents.map(normalizeSearchAgent).filter((row): row is SearchIndexAgent => row !== null)
      : [],
    activityLogs: Array.isArray(data.activityLogs)
      ? data.activityLogs
          .map(normalizeSearchActivityLog)
          .filter((row): row is SearchIndexActivityLog => row !== null)
      : [],
    agentRuns: Array.isArray(data.agentRuns)
      ? data.agentRuns
          .map(normalizeSearchAgentRun)
          .filter((row): row is SearchIndexAgentRun => row !== null)
      : [],
  };
}
