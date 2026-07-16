/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "@/lib/prisma";
import { getUserSearchIndex } from "@/lib/search/get-search-index";

jest.mock("@/lib/user-agents", () => ({
  getUserAgentCards: jest.fn().mockResolvedValue([]),
}));

const findManyMock = jest.mocked(prisma.project.findMany);
const activityFindManyMock = jest.mocked(prisma.activityLog.findMany);

const origFetch = globalThis.fetch;
const origAgentKey = process.env.AGENT_SERVICE_KEY;
const origAgentUrl = process.env.AGENT_SERVICE_URL;

function mockAgentFetch(agents: unknown[], runs: unknown[] = []) {
  (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes("/api/runs/recent")) {
      return Promise.resolve(new Response(JSON.stringify(runs), { status: 200 }));
    }
    if (url.includes("/api/agents")) {
      return Promise.resolve(new Response(JSON.stringify(agents), { status: 200 }));
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  });
}

describe("getUserSearchIndex", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENT_SERVICE_KEY = "test-agent-key";
    process.env.AGENT_SERVICE_URL = "http://agent-service.test";
    globalThis.fetch = jest.fn() as unknown as typeof fetch;

    findManyMock.mockResolvedValue([
      {
        id: "p1",
        slug: "demo-app",
        name: "Demo App",
        description: "A demo project",
      },
      {
        id: "p2",
        slug: "api-sandbox",
        name: "API Sandbox",
        description: null,
      },
    ]);

    activityFindManyMock.mockResolvedValue([
      {
        id: "log-1",
        action: "Container started",
        status: "DONE",
        entityName: null,
        agentId: null,
        runId: null,
        createdAt: new Date("2026-07-16T08:00:00.000Z"),
        project: { name: "Demo App", slug: "demo-app" },
      },
    ]);

    mockAgentFetch(
      [
        { id: "a1", name: "Research", description: "Finds papers" },
        { id: "a2", name: "Ops", description: null },
      ],
      [
        {
          id: "run-1",
          agentId: "a1",
          status: "RUNNING",
          createdAt: "2026-07-16T08:00:00.000Z",
          agent: { id: "a1", name: "Research" },
        },
      ],
    );
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.AGENT_SERVICE_KEY = origAgentKey;
    process.env.AGENT_SERVICE_URL = origAgentUrl;
  });

  it("returns projects, agents, activity logs, and recent runs", async () => {
    const index = await getUserSearchIndex("user-1");

    expect(index).toEqual({
      projects: [
        { id: "p1", slug: "demo-app", name: "Demo App", description: "A demo project" },
        { id: "p2", slug: "api-sandbox", name: "API Sandbox", description: "" },
      ],
      agents: [
        { id: "a1", name: "Research", description: "Finds papers" },
        { id: "a2", name: "Ops", description: "" },
      ],
      activityLogs: [
        {
          id: "log-1",
          action: "Container started",
          status: "DONE",
          entityName: "Demo App",
          occurredAt: "2026-07-16T08:00:00.000Z",
          href: "/projects/demo-app",
        },
      ],
      agentRuns: [
        {
          id: "run-1",
          agentId: "a1",
          agentName: "Research",
          status: "RUNNING",
          createdAt: "2026-07-16T08:00:00.000Z",
        },
      ],
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    );

    const fetchCalls = (globalThis.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
    expect(fetchCalls.some((url) => url.includes("/api/agents?userId=user-1"))).toBe(true);
    expect(fetchCalls.some((url) => url.includes("/api/runs/recent?userId=user-1"))).toBe(true);
  });

  it("returns empty agents and runs when agent service is unreachable", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    const index = await getUserSearchIndex("user-1");

    expect(index.projects).toHaveLength(2);
    expect(index.agents).toEqual([]);
    expect(index.agentRuns).toEqual([]);
    expect(index.activityLogs).toHaveLength(1);
  });

  it("returns empty agents when agent service responds with non-OK", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response("upstream error", { status: 502 }));

    const index = await getUserSearchIndex("user-1");

    expect(index.agents).toEqual([]);
    expect(index.agentRuns).toEqual([]);
  });
});
