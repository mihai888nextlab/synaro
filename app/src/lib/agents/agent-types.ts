import type { ReActStep } from "@/lib/agents/react-step";

export type McpServer = {
  name: string;
  url: string;
  transport?: "http" | "sse";
  headers?: Record<string, string>;
};

export const MODEL_OPTIONS = [
  "kimi-k2.7-code",
  "moonshot-v1-8k",
  "moonshot-v1-32k",
  "moonshot-v1-128k",
] as const;

export type AgentMemoryEntry = {
  key: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunStatus = "PENDING" | "RUNNING" | "NEEDS_INPUT" | "DONE" | "FAILED" | "CANCELLED" | string;

export type McpCredentialField = {
  key: string;
  label: string;
  type: "password" | "text";
  placeholder?: string;
};

export type McpCredentialRequest = {
  server: string;
  url: string;
  fields: McpCredentialField[];
};

export type AgentRun = {
  id: string;
  agentId?: string;
  status: AgentRunStatus;
  trigger: string;
  input?: string | null;
  output?: string | null;
  /** Structured dashboard widgets from finish({ artifacts }). */
  artifacts?: unknown;
  steps?: ReActStep[] | null;
  credentialRequest?: McpCredentialRequest | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type AgentToolMode = "auto" | "manual";

export type Agent = {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  tools: string[];
  toolMode?: AgentToolMode | string;
  maxSteps: number;
  schedule?: string | null;
  enabled: boolean;
  emailOnComplete?: boolean;
  model?: string | null;
  mcpServers?: McpServer[] | null;
  createdAt: string;
  updatedAt?: string;
};

export type AgentFormValues = {
  name: string;
  description: string;
  systemPrompt: string;
  toolMode: AgentToolMode;
  tools: string[];
  maxSteps: number;
  schedule: string;
  emailOnComplete: boolean;
  model: string;
  mcpServers: string;
};

export const DEFAULT_AGENT_FORM_VALUES: AgentFormValues = {
  name: "",
  description: "",
  systemPrompt: "",
  toolMode: "auto",
  tools: [],
  maxSteps: 20,
  schedule: "",
  emailOnComplete: false,
  model: MODEL_OPTIONS[0],
  mcpServers: "",
};

export function agentToFormValues(agent: Agent): AgentFormValues {
  const toolMode = agent.toolMode === "manual" ? "manual" : "auto";
  return {
    name: agent.name,
    description: agent.description ?? "",
    systemPrompt: agent.systemPrompt,
    toolMode,
    tools: [...agent.tools],
    maxSteps: agent.maxSteps,
    schedule: agent.schedule ?? "",
    emailOnComplete: agent.emailOnComplete ?? false,
    model: agent.model ?? MODEL_OPTIONS[0],
    mcpServers: agent.mcpServers ? JSON.stringify(agent.mcpServers, null, 2) : "",
  };
}

export function parseMcpServers(raw: string): McpServer[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) throw new Error("expected an array");
  return parsed as McpServer[];
}

export function buildAgentCreateBody(form: AgentFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name,
    systemPrompt: form.systemPrompt,
    toolMode: form.toolMode,
    maxSteps: form.maxSteps,
    model: form.model,
    emailOnComplete: form.emailOnComplete,
  };
  const description = form.description.trim();
  if (description) body.description = description;
  const schedule = form.schedule.trim();
  if (schedule) body.schedule = schedule;
  if (form.toolMode === "manual") {
    body.tools = form.tools;
  }
  const mcpRaw = form.mcpServers.trim();
  if (mcpRaw) {
    body.mcpServers = parseMcpServers(mcpRaw);
  }
  return body;
}

/** PATCH body — null clears optional string fields on the agent-service. */
export function buildAgentUpdateBody(form: AgentFormValues): Record<string, unknown> {
  const mcpRaw = form.mcpServers.trim();
  return {
    name: form.name,
    description: form.description.trim() || null,
    systemPrompt: form.systemPrompt,
    toolMode: form.toolMode,
    tools: form.toolMode === "manual" ? form.tools : [],
    maxSteps: form.maxSteps,
    schedule: form.schedule.trim() || null,
    model: form.model,
    emailOnComplete: form.emailOnComplete,
    mcpServers: mcpRaw ? parseMcpServers(mcpRaw) : [],
  };
}

export function formatAgentApiError(
  error: unknown,
  fallback: string,
  upstreamMessage?: unknown,
): string {
  if (typeof upstreamMessage === "string" && upstreamMessage.trim()) {
    const firstLine = upstreamMessage.split("\n").find((line) => line.trim());
    if (firstLine) return firstLine.trim();
  }
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const flat = error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      message?: string;
    };
    if (typeof flat.message === "string" && flat.message.trim()) {
      return flat.message.split("\n")[0]?.trim() ?? fallback;
    }
    const parts = [
      ...(flat.formErrors ?? []),
      ...Object.entries(flat.fieldErrors ?? {}).flatMap(([field, msgs]) =>
        msgs.map((m) => `${field}: ${m}`),
      ),
    ];
    if (parts.length > 0) return parts.join("; ");
  }
  return fallback;
}
