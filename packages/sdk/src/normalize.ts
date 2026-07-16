import type { Agent, AgentRun } from "./types.js";

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

/** Ensure `agentId` (and alias `id`) are always set from wire `id` / `agentId`. */
export function normalizeAgent(raw: unknown): Agent {
  const obj = asRecord(raw);
  const agentId = String(obj.agentId ?? obj.id ?? "");
  return {
    ...(obj as unknown as Agent),
    agentId,
    id: agentId || (obj.id as string | undefined),
  };
}

export function normalizeAgents(raw: unknown): Agent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAgent);
}

/** Ensure `runId` (and alias `id`) are always set from wire `id` / `runId`. */
export function normalizeRun(raw: unknown): AgentRun {
  const obj = asRecord(raw);
  const runId = String(obj.runId ?? obj.id ?? "");
  const agentId = String(obj.agentId ?? "");
  return {
    ...(obj as unknown as AgentRun),
    runId,
    id: runId || (obj.id as string | undefined),
    agentId,
  };
}

export function normalizeRuns(raw: unknown): AgentRun[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRun);
}

export function agentIdOf(agent: Pick<Agent, "agentId" | "id">): string {
  return String(agent.agentId ?? agent.id ?? "");
}

export function runIdOf(run: Pick<AgentRun, "runId" | "id">): string {
  return String(run.runId ?? run.id ?? "");
}
