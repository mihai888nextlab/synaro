import { getUserSearchActivityLogs } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { whereProjectVisibleToUser } from "@/lib/project-access";

import {
  EMPTY_SEARCH_INDEX,
  normalizeSearchActivityLog,
  normalizeSearchAgent,
  normalizeSearchAgentRun,
  normalizeSearchIndex,
  normalizeSearchProject,
} from "./normalize-search-index";
import type { SearchIndex, SearchIndexAgent, SearchIndexAgentRun } from "./search-index";

type AgentServiceAgent = {
  id: string;
  name: string;
  description?: string | null;
};

type AgentServiceRun = {
  id: string;
  agentId: string;
  status: string;
  createdAt: string;
  agent?: { id: string; name: string } | null;
};

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

function agentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

async function getUserSearchAgents(userId: string): Promise<SearchIndexAgent[]> {
  try {
    const upstream = await fetch(
      `${agentServiceUrl()}/api/agents?userId=${encodeURIComponent(userId)}`,
      { headers: agentHeaders() },
    );
    if (!upstream.ok) return [];

    const data = (await upstream.json()) as unknown;
    if (!Array.isArray(data)) return [];

    return data
      .map((agent) =>
        normalizeSearchAgent({
          id: (agent as AgentServiceAgent).id,
          name: (agent as AgentServiceAgent).name,
          description: (agent as AgentServiceAgent).description?.trim() ?? "",
        }),
      )
      .filter((agent): agent is SearchIndexAgent => agent !== null);
  } catch {
    return [];
  }
}

async function getUserSearchAgentRuns(userId: string): Promise<SearchIndexAgentRun[]> {
  try {
    const upstream = await fetch(
      `${agentServiceUrl()}/api/runs/recent?userId=${encodeURIComponent(userId)}&limit=30`,
      { headers: agentHeaders() },
    );
    if (!upstream.ok) return [];

    const data = (await upstream.json()) as unknown;
    if (!Array.isArray(data)) return [];

    return data
      .map((run) => {
        const row = run as AgentServiceRun;
        return normalizeSearchAgentRun({
          id: row.id,
          agentId: row.agentId,
          agentName: row.agent?.name?.trim() || "Agent",
          status: row.status,
          createdAt: row.createdAt,
        });
      })
      .filter((row): row is SearchIndexAgentRun => row !== null);
  } catch {
    return [];
  }
}

async function getUserSearchProjects(userId: string) {
  try {
    const projectRows = await prisma.project.findMany({
      where: whereProjectVisibleToUser(userId),
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return projectRows
      .map((row) =>
        normalizeSearchProject({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description ?? "",
        }),
      )
      .filter((row) => row !== null);
  } catch {
    return [];
  }
}

async function getUserSearchActivityLogsSafe(userId: string) {
  try {
    const rows = await getUserSearchActivityLogs(userId);
    return rows
      .map((row) => normalizeSearchActivityLog(row))
      .filter((row) => row !== null);
  } catch {
    return [];
  }
}

/** Minimal project, agent, activity, and run list for global search. */
export async function getUserSearchIndex(userId: string): Promise<SearchIndex> {
  const [projects, agents, activityLogs, agentRuns] = await Promise.all([
    getUserSearchProjects(userId),
    getUserSearchAgents(userId),
    getUserSearchActivityLogsSafe(userId),
    getUserSearchAgentRuns(userId),
  ]);

  return normalizeSearchIndex({
    projects,
    agents,
    activityLogs,
    agentRuns,
  });
}

export { EMPTY_SEARCH_INDEX };
