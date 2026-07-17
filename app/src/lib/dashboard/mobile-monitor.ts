import type { DashboardLayout, DashboardPageData } from "@/lib/dashboard/layout-schema";

export const MAX_MOBILE_LAST_RUNS = 4;

/** Prefer agents pinned via agent_last_run widgets; otherwise enabled agents. */
export function resolveMobileLastRunAgents(
  layout: DashboardLayout,
  agents: DashboardPageData["agents"],
): { agentId: string; name: string }[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const fromLayout: string[] = [];

  const ordered = [...layout.widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const widget of ordered) {
    if (widget.type !== "agent_last_run") continue;
    const agentId = (widget.config as { agentId?: string } | undefined)?.agentId;
    if (!agentId || fromLayout.includes(agentId) || !agentById.has(agentId)) continue;
    fromLayout.push(agentId);
  }

  const ids =
    fromLayout.length > 0
      ? fromLayout
      : agents.filter((agent) => agent.enabled).map((agent) => agent.id);

  return ids.slice(0, MAX_MOBILE_LAST_RUNS).flatMap((agentId) => {
    const agent = agentById.get(agentId);
    return agent ? [{ agentId, name: agent.name }] : [];
  });
}
