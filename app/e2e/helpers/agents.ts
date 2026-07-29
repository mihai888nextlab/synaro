import type { Page } from "@playwright/test";

export const E2E_AGENT_ID = "agent-e2e-1";
export const E2E_AGENT_DISABLED_ID = "agent-e2e-disabled";
export const E2E_AGENT_SCHEDULED_ID = "agent-e2e-scheduled";
export const E2E_RUN_ID = "run-e2e-1";
export const E2E_RUN_NEEDS_INPUT_ID = "run-e2e-needs-input";

export type E2EAgentRecord = {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  tools: string[];
  toolMode?: string;
  maxSteps: number;
  schedule?: string | null;
  enabled: boolean;
  model?: string | null;
  mcpServers?: Array<{ name: string; url: string }> | null;
  createdAt: string;
};

export type E2ECredentialRequest = {
  server: string;
  url: string;
  fields: Array<{
    key: string;
    label: string;
    type: "password" | "text";
    placeholder?: string;
  }>;
};

export type E2ERunRecord = {
  id: string;
  agentId: string;
  status: string;
  trigger: string;
  input?: string | null;
  output?: string | null;
  steps?: Array<{
    step: number;
    tool: string;
    args: Record<string, unknown>;
    observation: string;
  }> | null;
  credentialRequest?: E2ECredentialRequest | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  agent?: { id: string; name: string } | null;
};

const now = () => new Date().toISOString();

export function makeAutoAgent(overrides: Partial<E2EAgentRecord> = {}): E2EAgentRecord {
  return {
    id: E2E_AGENT_ID,
    name: "E2E Research Agent",
    description: "Seeded for agents tests",
    systemPrompt: "Research assistant",
    tools: [],
    toolMode: "auto",
    maxSteps: 20,
    schedule: null,
    enabled: true,
    model: "kimi-k2.7-code",
    mcpServers: null,
    createdAt: now(),
    ...overrides,
  };
}

export function makeManualAgent(overrides: Partial<E2EAgentRecord> = {}): E2EAgentRecord {
  return makeAutoAgent({
    toolMode: "manual",
    tools: ["web_search"],
    ...overrides,
  });
}

export function makeScheduledAgent(overrides: Partial<E2EAgentRecord> = {}): E2EAgentRecord {
  return makeAutoAgent({
    id: E2E_AGENT_SCHEDULED_ID,
    name: "E2E Scheduled Agent",
    schedule: "0 9 * * 1",
    ...overrides,
  });
}

export function makeDisabledAgent(): E2EAgentRecord {
  return makeAutoAgent({
    id: E2E_AGENT_DISABLED_ID,
    name: "E2E Disabled Agent",
    enabled: false,
  });
}

export function makeRunRunning(overrides: Partial<E2ERunRecord> = {}): E2ERunRecord {
  return {
    id: E2E_RUN_ID,
    agentId: E2E_AGENT_ID,
    status: "RUNNING",
    trigger: "manual",
    input: "Find Synaro docs",
    output: null,
    steps: [
      {
        step: 1,
        tool: "web_search",
        args: { query: "Synaro" },
        observation: "Found several results about Synaro.",
      },
    ],
    startedAt: now(),
    finishedAt: null,
    createdAt: now(),
    ...overrides,
  };
}

export function makeRunDone(overrides: Partial<E2ERunRecord> = {}): E2ERunRecord {
  return makeRunRunning({
    status: "DONE",
    output: "Synaro is an AI dev workspace.",
    finishedAt: now(),
    ...overrides,
  });
}

export function makeRunFailed(overrides: Partial<E2ERunRecord> = {}): E2ERunRecord {
  return makeRunDone({
    status: "FAILED",
    output: "Could not connect to any MCP server.",
    finishedAt: now(),
    ...overrides,
  });
}

export function makeRunNeedsInput(overrides: Partial<E2ERunRecord> = {}): E2ERunRecord {
  return makeRunRunning({
    id: E2E_RUN_NEEDS_INPUT_ID,
    status: "NEEDS_INPUT",
    output: null,
    steps: [],
    credentialRequest: {
      server: "github",
      url: "https://api.githubcopilot.com/mcp/",
      fields: [
        {
          key: "Authorization",
          label: "Access token",
          type: "password",
          placeholder: "Bearer ghp_… or your MCP token",
        },
      ],
    },
    ...overrides,
  });
}

export function makeRunCancelled(overrides: Partial<E2ERunRecord> = {}): E2ERunRecord {
  return makeRunRunning({
    status: "CANCELLED",
    output: "Cancelled by user",
    finishedAt: now(),
    ...overrides,
  });
}

export type E2EMemoryEntry = {
  key: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentApiMockOptions = {
  agents?: E2EAgentRecord[];
  getAgent?: (id: string) => E2EAgentRecord | undefined;
  runsByAgentId?: Record<string, E2ERunRecord[]>;
  getRun?: (runId: string, pollCount: number) => E2ERunRecord | undefined;
  activeRuns?: E2ERunRecord[];
  memoryByAgentId?: Record<string, E2EMemoryEntry[]>;
  onUpsertMemory?: (
    agentId: string,
    key: string,
    content: string,
  ) => E2EMemoryEntry | { status: number; body: unknown };
  onDeleteMemory?: (agentId: string, key: string) => { status: number; body?: unknown };
  onClearMemory?: (agentId: string) => { status: number; body?: unknown };
  onCreateAgent?: (body: Record<string, unknown>) => E2EAgentRecord | { status: number; body: unknown };
  onPatchAgent?: (
    id: string,
    body: Record<string, unknown>,
  ) => E2EAgentRecord | { status: number; body: unknown };
  onTrigger?: (
    agentId: string,
    body: Record<string, unknown>,
  ) => { runId: string } | { status: number; body: unknown };
  onSubmitCredentials?: (runId: string, body: Record<string, unknown>) => { status: number; body?: unknown };
  onCancelRun?: (runId: string) => { status: number; body?: unknown };
};

/** Register Playwright routes for agents BFF endpoints used by the UI. */
export async function mockAgentApi(page: Page, options: AgentApiMockOptions = {}): Promise<void> {
  let agents = [...(options.agents ?? [])];
  const runsByAgent = { ...(options.runsByAgentId ?? {}) };
  const memoryByAgent = { ...(options.memoryByAgentId ?? {}) };
  const runPollCounts = new Map<string, number>();

  const resolveAgent = (id: string) => options.getAgent?.(id) ?? agents.find((a) => a.id === id);

  await page.route("**/api/agents/active-runs", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.activeRuns ?? []),
    });
  });

  await page.route("**/api/agents", async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (url.includes("/api/agents/active-runs")) return route.continue();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(agents),
      });
      return;
    }
    if (method === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const result = options.onCreateAgent?.(body);
      if (result && "status" in result) {
        await route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify(result.body),
        });
        return;
      }
      const created =
        result ??
        makeAutoAgent({
          id: `agent-created-${Date.now()}`,
          name: String(body.name ?? "New Agent"),
          systemPrompt: String(body.systemPrompt ?? ""),
          toolMode: String(body.toolMode ?? "auto"),
          tools: Array.isArray(body.tools) ? (body.tools as string[]) : [],
          schedule: typeof body.schedule === "string" ? body.schedule : null,
          maxSteps: Number(body.maxSteps ?? 20),
        });
      agents = [...agents, created];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }
    await route.continue();
  });

  await page.route(/\/api\/agents\/[^/]+\/memory\/[^/]+$/, async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const agentId = segments[segments.length - 3]!;
    const rawKey = segments[segments.length - 1]!;
    const key = decodeURIComponent(rawKey);
    const method = route.request().method();

    if (method === "PUT") {
      const body = route.request().postDataJSON() as { content?: string };
      const content = typeof body.content === "string" ? body.content : "";
      const result = options.onUpsertMemory?.(agentId, key, content);
      if (result && "status" in result) {
        await route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify(result.body),
        });
        return;
      }
      const now = new Date().toISOString();
      const existing = (memoryByAgent[agentId] ?? []).find((e) => e.key === key);
      const entry =
        result ??
        ({
          key,
          content,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        } satisfies E2EMemoryEntry);
      const others = (memoryByAgent[agentId] ?? []).filter((e) => e.key !== key);
      memoryByAgent[agentId] = [...others, entry as E2EMemoryEntry];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entry),
      });
      return;
    }

    if (method === "DELETE") {
      const result = options.onDeleteMemory?.(agentId, key) ?? { status: 204 };
      if (result.status === 204) {
        memoryByAgent[agentId] = (memoryByAgent[agentId] ?? []).filter((e) => e.key !== key);
      }
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: result.body ? JSON.stringify(result.body) : "",
      });
      return;
    }

    await route.continue();
  });

  await page.route(/\/api\/agents\/[^/]+\/memory$/, async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const agentId = segments[segments.length - 2]!;
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(memoryByAgent[agentId] ?? []),
      });
      return;
    }

    if (method === "DELETE") {
      const result = options.onClearMemory?.(agentId) ?? { status: 204 };
      if (result.status === 204) {
        memoryByAgent[agentId] = [];
      }
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: result.body ? JSON.stringify(result.body) : "",
      });
      return;
    }

    await route.continue();
  });

  await page.route(/\/api\/agents\/(?!active-runs)[^/]+$/, async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const agentId = segments[segments.length - 1]!;
    const method = route.request().method();

    if (method === "GET") {
      const agent = resolveAgent(agentId);
      if (!agent) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Not found" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(agent),
      });
      return;
    }

    if (method === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const result = options.onPatchAgent?.(agentId, body);
      if (result && "status" in result) {
        await route.fulfill({
          status: result.status,
          contentType: "application/json",
          body: JSON.stringify(result.body),
        });
        return;
      }
      const existing = resolveAgent(agentId);
      if (!existing) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Not found" }),
        });
        return;
      }
      const updated = result ?? {
        ...existing,
        ...body,
        name: typeof body.name === "string" ? body.name : existing.name,
        toolMode: typeof body.toolMode === "string" ? body.toolMode : existing.toolMode,
        tools: Array.isArray(body.tools) ? (body.tools as string[]) : existing.tools,
        schedule:
          body.schedule === null
            ? null
            : typeof body.schedule === "string"
              ? body.schedule
              : existing.schedule,
      };
      agents = agents.map((a) => (a.id === agentId ? (updated as E2EAgentRecord) : a));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updated),
      });
      return;
    }

    await route.continue();
  });

  await page.route(/\/api\/agents\/[^/]+\/runs$/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const agentId = segments[segments.length - 2]!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(runsByAgent[agentId] ?? []),
    });
  });

  await page.route(/\/api\/agents\/[^/]+\/trigger$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const agentId = segments[segments.length - 2]!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const result = options.onTrigger?.(agentId, body);
    if (result && "status" in result) {
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        body: JSON.stringify(result.body),
      });
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify(result ?? { runId: E2E_RUN_ID }),
    });
  });

  await page.route(/\/api\/agents\/runs\/[^/]+\/credentials$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const runId = segments[segments.length - 2]!;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const result = options.onSubmitCredentials?.(runId, body) ?? { status: 202, body: { ok: true } };
    await route.fulfill({
      status: result.status,
      contentType: "application/json",
      body: JSON.stringify(result.body ?? { ok: true }),
    });
  });

  await page.route(/\/api\/agents\/runs\/[^/]+\/cancel$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const runId = segments[segments.length - 2]!;
    const result = options.onCancelRun?.(runId) ?? { status: 200, body: { ok: true } };
    await route.fulfill({
      status: result.status,
      contentType: "application/json",
      body: JSON.stringify(result.body ?? { ok: true }),
    });
  });

  await page.route(/\/api\/agents\/runs\/[^/]+$/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/");
    const runId = segments[segments.length - 1]!;
    const poll = (runPollCounts.get(runId) ?? 0) + 1;
    runPollCounts.set(runId, poll);
    const run = options.getRun?.(runId, poll);
    if (!run) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(run),
    });
  });
}

/** Accept the next window.confirm dialog (cancel run, delete, etc.). */
export function acceptNextDialog(page: Page): void {
  page.once("dialog", (dialog) => void dialog.accept());
}
