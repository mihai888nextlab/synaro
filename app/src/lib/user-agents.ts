import type { SynaroAgentCardModel } from "@/components/ui/agent-cards-grid";
import { formatShortRelativeTime } from "@/lib/relative-time";

type AgentServiceAgent = {
  id: string;
  name: string;
  description?: string | null;
  tools?: string[];
  enabled: boolean;
  createdAt: string;
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

/** User agents from agent-service, mapped for dashboard / card grids. */
export async function getUserAgentCards(userId: string): Promise<SynaroAgentCardModel[]> {
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
      toolsCount: agent.tools?.length ?? 0,
      enabled: Boolean(agent.enabled),
      createdRelative: formatShortRelativeTime(new Date(agent.createdAt)),
    }));
  } catch {
    return [];
  }
}
