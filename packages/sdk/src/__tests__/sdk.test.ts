import { afterEach, describe, expect, it, vi } from "vitest";

import { Synaro } from "../synaro.js";
import {
  AuthError,
  NeedsInputError,
  RateLimitError,
  SynaroError,
} from "../errors.js";
import { toCamelCase, toSnakeCase } from "../case.js";

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("case helpers", () => {
  it("round-trips nested objects", () => {
    const camel = { projectId: "p1", nested: { createdAt: "x" } };
    expect(toCamelCase(toSnakeCase(camel))).toEqual(camel);
  });
});

describe("Synaro SDK", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    fetchMock.mockReset();
  });

  function client() {
    return new Synaro({
      apiKey: "sk_live_test",
      baseUrl: "https://api.test",
      fetch: fetchMock as unknown as typeof fetch,
      retryOnRateLimit: false,
    });
  }

  it("does not expose apiKey on the HTTP client", () => {
    const synaro = client();
    expect((synaro.http as { apiKey?: string }).apiKey).toBeUndefined();
    expect("apiKey" in synaro.http).toBe(false);
  });

  it("me() sends Bearer auth and camelCases response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user_id: "u1",
        email: "a@b.c",
        name: "Ada",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    );

    const me = await client().me();
    expect(me).toEqual({
      userId: "u1",
      email: "a@b.c",
      name: "Ada",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.test/api/v1/me");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk_live_test",
    });
  });

  it("projects.create sends snake_case body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        project_id: "p1",
        slug: "demo",
        name: "Demo",
        description: null,
        environment_status: "PROVISIONING",
        repository_location: null,
        clone_repository_url: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        environment_warning: null,
      }),
    );

    const project = await client().projects.create({
      name: "Demo",
      repositoryUrl: "https://github.com/acme/demo",
    });
    expect(project.projectId).toBe("p1");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      name: "Demo",
      repository_url: "https://github.com/acme/demo",
    });
  });

  it("agents.create normalizes id → agentId and strips credentials", async () => {
    await expect(
      client().agents.create({
        name: "Bot",
        systemPrompt: "Hi",
        // @ts-expect-error intentional forbidden field
        mcpAuth: { x: {} },
      }),
    ).rejects.toThrow(/credentials_not_allowed/);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { id: "a1", name: "Bot", system_prompt: "Hi" }),
    );
    const agent = await client().agents.create({
      name: "Bot",
      systemPrompt: "Hi",
      toolMode: "auto",
    });
    expect(agent.agentId).toBe("a1");
    expect(agent.id).toBe("a1");
    expect(client().agents.idOf(agent)).toBe("a1");

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      name: "Bot",
      systemPrompt: "Hi",
      toolMode: "auto",
    });
  });

  it("agents.trigger + runs.wait polls until DONE", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(202, { run_id: "r1" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { id: "r1", agent_id: "a1", status: "RUNNING" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: "r1",
          agent_id: "a1",
          status: "DONE",
          output: "ok",
        }),
      );

    const run = await client().agents.run("a1", "hello", {
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });
    expect(run.status).toBe("DONE");
    expect(run.output).toBe("ok");
    expect(run.runId).toBe("r1");
  });

  it("runs.watch yields snapshots until DONE", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { id: "r1", agent_id: "a1", status: "RUNNING" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { id: "r1", agent_id: "a1", status: "DONE", output: "ok" }),
      );

    const snapshots: string[] = [];
    for await (const update of client().runs.watch("r1", { pollIntervalMs: 1 })) {
      snapshots.push(String(update.status));
    }
    expect(snapshots).toEqual(["RUNNING", "DONE"]);
  });

  it("tasks.watch polls with wait=false", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", project_id: "p1", status: "PENDING" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", project_id: "p1", status: "DONE", summary: "x" }),
      );

    const statuses: string[] = [];
    for await (const update of client().tasks.watch("t1", { pollIntervalMs: 1 })) {
      statuses.push(String(update.status));
    }
    expect(statuses).toEqual(["PENDING", "DONE"]);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("wait=false");
  });

  it("runs.wait throws NeedsInputError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "r1", agent_id: "a1", status: "NEEDS_INPUT" }),
    );

    await expect(client().runs.wait("r1", { pollIntervalMs: 1 })).rejects.toBeInstanceOf(
      NeedsInputError,
    );
  });

  it("maps 401 to AuthError and 429 to RateLimitError", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: "unauthorized", detail: "bad key" }),
    );
    await expect(client().me()).rejects.toBeInstanceOf(AuthError);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        429,
        { error: "rate_limit_exceeded", detail: "slow down" },
        { "Retry-After": "2", "X-RateLimit-Limit": "120", "X-RateLimit-Remaining": "0" },
      ),
    );
    await expect(client().me()).rejects.toBeInstanceOf(RateLimitError);
  });

  it("tasks.run creates then waits", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(202, {
          task_id: "t1",
          status: "PENDING",
          poll_url: "/api/v1/tasks/t1",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          task_id: "t1",
          project_id: "p1",
          status: "DONE",
          summary: "done",
        }),
      );

    const result = await client().tasks.run("p1", "Add tests", { timeoutSeconds: 10 });
    expect(result.taskId).toBe("t1");
    expect(result.summary).toBe("done");
  });

  it("runs.cancel and memory.upsert hit Phase 2 paths", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, run_id: "r1" }));
    await client().runs.cancel("r1");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/api/v1/runs/r1/cancel");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { key: "k", content: "v" }));
    await client().agents.memory("a1").upsert("k", "v");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/api/v1/agents/a1/memory/k");
  });

  it("throws SynaroError with status for 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(502, { error: "upstream" }));
    try {
      await client().projects.list();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SynaroError);
      expect((err as SynaroError).status).toBe(502);
    }
  });
});
