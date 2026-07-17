import type { SynaroHttpClient } from "../client.js";
import type { RunsResource } from "./runs.js";
import { agentIdOf, normalizeAgent, normalizeAgents, normalizeRuns } from "../normalize.js";
import type {
  Agent,
  CreateAgentInput,
  ListRunsOptions,
  MemoryEntry,
  TriggerOptions,
  TriggerResult,
  UpdateAgentInput,
  WaitOptions,
  AgentRun,
} from "../types.js";

const CREDENTIAL_KEYS = new Set([
  "mcpAuth",
  "mcp_auth",
  "credentials",
  "runtimeAuth",
  "runtime_auth",
]);

function assertNoCredentials(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (CREDENTIAL_KEYS.has(key)) {
      throw new Error(`credentials_not_allowed_in_agent_body: ${key}`);
    }
  }
}

function stripAuthHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeAgentWriteBody(input: CreateAgentInput | UpdateAgentInput): Record<string, unknown> {
  const body = { ...input } as Record<string, unknown>;
  assertNoCredentials(body);
  if (Array.isArray(body.mcpServers)) {
    body.mcpServers = (body.mcpServers as CreateAgentInput["mcpServers"])!.map((server) => ({
      ...server,
      headers: stripAuthHeaders(server.headers),
    }));
  }
  return body;
}

export class AgentMemoryResource {
  constructor(
    private readonly http: SynaroHttpClient,
    private readonly agentId: string,
  ) {}

  list(): Promise<MemoryEntry[]> {
    return this.http.request(
      `/api/v1/agents/${encodeURIComponent(this.agentId)}/memory`,
    );
  }

  clear(): Promise<void> {
    return this.http.request(
      `/api/v1/agents/${encodeURIComponent(this.agentId)}/memory`,
      { method: "DELETE", empty: true },
    );
  }

  upsert(key: string, content: string): Promise<MemoryEntry> {
    return this.http.request(
      `/api/v1/agents/${encodeURIComponent(this.agentId)}/memory/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: { content },
      },
    );
  }

  delete(key: string): Promise<void> {
    return this.http.request(
      `/api/v1/agents/${encodeURIComponent(this.agentId)}/memory/${encodeURIComponent(key)}`,
      { method: "DELETE", empty: true },
    );
  }
}

export class AgentsResource {
  constructor(
    private readonly http: SynaroHttpClient,
    private readonly runs: RunsResource,
  ) {}

  async list(): Promise<Agent[]> {
    const raw = await this.http.request<unknown>("/api/v1/agents");
    return normalizeAgents(raw);
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    const raw = await this.http.request<unknown>("/api/v1/agents", {
      method: "POST",
      body: sanitizeAgentWriteBody(input),
    });
    return normalizeAgent(raw);
  }

  async get(agentId: string): Promise<Agent> {
    const raw = await this.http.request<unknown>(
      `/api/v1/agents/${encodeURIComponent(agentId)}`,
    );
    return normalizeAgent(raw);
  }

  async update(agentId: string, patch: UpdateAgentInput): Promise<Agent> {
    const raw = await this.http.request<unknown>(
      `/api/v1/agents/${encodeURIComponent(agentId)}`,
      {
        method: "PATCH",
        body: sanitizeAgentWriteBody(patch),
      },
    );
    return normalizeAgent(raw);
  }

  delete(agentId: string): Promise<void> {
    return this.http.request<void>(`/api/v1/agents/${encodeURIComponent(agentId)}`, {
      method: "DELETE",
      empty: true,
    });
  }

  async trigger(agentId: string, opts: TriggerOptions = {}): Promise<TriggerResult> {
    const raw = await this.http.request<{ runId?: string }>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/trigger`,
      {
        method: "POST",
        body: {
          input: opts.input,
          trigger: opts.trigger ?? "manual",
        },
      },
    );
    return { runId: String(raw.runId ?? "") };
  }

  async listRuns(agentId: string, opts: ListRunsOptions = {}): Promise<AgentRun[]> {
    const raw = await this.http.request<unknown>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/runs`,
      {
        query: {
          limit: opts.limit,
          offset: opts.offset,
        },
      },
    );
    return normalizeRuns(raw);
  }

  memory(agentId: string): AgentMemoryResource {
    return new AgentMemoryResource(this.http, agentId);
  }

  /**
   * Trigger a run and wait until terminal status.
   * Throws NeedsInputError when the run pauses for MCP credentials.
   */
  async run(
    agentId: string,
    input?: string,
    opts?: WaitOptions & { trigger?: TriggerOptions["trigger"] },
  ): Promise<AgentRun> {
    const triggered = await this.trigger(agentId, {
      input,
      trigger: opts?.trigger ?? "manual",
    });
    const runId = triggered.runId;
    if (!runId) throw new Error("trigger did not return runId");
    return this.runs.wait(runId, opts);
  }

  /** Canonical agent id (`agent.agentId`). */
  idOf(agent: Agent): string {
    return agentIdOf(agent);
  }
}
