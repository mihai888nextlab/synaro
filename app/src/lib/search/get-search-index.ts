import { prisma } from "@/lib/prisma";
import { whereProjectVisibleToUser } from "@/lib/project-access";

import type { SearchIndex, SearchIndexAgent } from "./search-index";

type AgentServiceAgent = {
  id: string;
  name: string;
  description?: string | null;
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

    return (data as AgentServiceAgent[]).map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description?.trim() ?? "",
    }));
  } catch {
    return [];
  }
}

/** Minimal project + agent list for global search (no environment-service). */
export async function getUserSearchIndex(userId: string): Promise<SearchIndex> {
  const [projectRows, agents] = await Promise.all([
    prisma.project.findMany({
      where: whereProjectVisibleToUser(userId),
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    getUserSearchAgents(userId),
  ]);

  return {
    projects: projectRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
    })),
    agents,
  };
}
