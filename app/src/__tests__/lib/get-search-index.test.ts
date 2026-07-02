/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "@/lib/prisma";
import { getUserSearchIndex } from "@/lib/search/get-search-index";

const findManyMock = jest.mocked(prisma.project.findMany);

const origFetch = globalThis.fetch;
const origAgentKey = process.env.AGENT_SERVICE_KEY;
const origAgentUrl = process.env.AGENT_SERVICE_URL;

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
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.AGENT_SERVICE_KEY = origAgentKey;
    process.env.AGENT_SERVICE_URL = origAgentUrl;
  });

  it("returns minimal project and agent fields without environment-service", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "a1", name: "Research", description: "Finds papers" },
          { id: "a2", name: "Ops", description: null },
        ]),
        { status: 200 },
      ),
    );

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

    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://agent-service.test/api/agents?userId=user-1");
    expect((init.headers as Record<string, string>)["X-Service-Key"]).toBe("test-agent-key");
  });

  it("returns empty agents when agent service is unreachable", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    const index = await getUserSearchIndex("user-1");

    expect(index.projects).toHaveLength(2);
    expect(index.agents).toEqual([]);
  });

  it("returns empty agents when agent service responds with non-OK", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response("upstream error", { status: 502 }));

    const index = await getUserSearchIndex("user-1");

    expect(index.agents).toEqual([]);
  });
});
