import type { ReActStep } from "@/lib/agents/react-step";

export type AgentRunStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | string;

export type AgentRun = {
  id: string;
  agentId: string;
  status: AgentRunStatus;
  trigger: string;
  input?: string | null;
  output?: string | null;
  steps?: ReActStep[] | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type Agent = {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  schedule?: string | null;
  enabled: boolean;
  createdAt: string;
};

export type AgentFormValues = {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxSteps: number;
  schedule: string;
};

export const DEFAULT_AGENT_FORM_VALUES: AgentFormValues = {
  name: "",
  description: "",
  systemPrompt: "",
  tools: [],
  maxSteps: 20,
  schedule: "",
};

export function agentToFormValues(agent: Agent): AgentFormValues {
  return {
    name: agent.name,
    description: agent.description ?? "",
    systemPrompt: agent.systemPrompt,
    tools: [...agent.tools],
    maxSteps: agent.maxSteps,
    schedule: agent.schedule ?? "",
  };
}
