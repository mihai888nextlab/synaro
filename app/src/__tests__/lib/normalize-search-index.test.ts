import { describe, expect, it } from "@jest/globals";

import {
  EMPTY_SEARCH_INDEX,
  normalizeSearchAgentRun,
  normalizeSearchIndex,
  normalizeSearchProject,
} from "@/lib/search/normalize-search-index";

describe("normalizeSearchIndex", () => {
  it("returns empty index for invalid payloads", () => {
    expect(normalizeSearchIndex(null)).toEqual(EMPTY_SEARCH_INDEX);
    expect(normalizeSearchIndex("bad")).toEqual(EMPTY_SEARCH_INDEX);
    expect(normalizeSearchIndex({})).toEqual(EMPTY_SEARCH_INDEX);
  });

  it("drops malformed projects and runs", () => {
    expect(
      normalizeSearchIndex({
        projects: [
          { id: "p1", slug: "demo", name: "Demo", description: "" },
          { id: "", slug: "bad", name: "Bad" },
        ],
        agents: [],
        activityLogs: [],
        agentRuns: [
          {
            id: "run-1",
            agentId: "a1",
            agentName: "Research",
            status: "DONE",
            createdAt: "2026-07-16T08:00:00.000Z",
          },
          {
            id: "run-2",
            agentId: "",
            agentName: "Broken",
            status: "DONE",
            createdAt: "not-a-date",
          },
        ],
      }),
    ).toEqual({
      projects: [{ id: "p1", slug: "demo", name: "Demo", description: "" }],
      agents: [],
      activityLogs: [],
      agentRuns: [
        {
          id: "run-1",
          agentId: "a1",
          agentName: "Research",
          status: "DONE",
          createdAt: "2026-07-16T08:00:00.000Z",
        },
      ],
    });
  });

  it("rejects unsafe href values on activity logs", () => {
    const logs = normalizeSearchIndex({
      projects: [],
      agents: [],
      activityLogs: [
        {
          id: "log-1",
          action: "Started",
          status: "DONE",
          entityName: "Demo",
          href: "https://evil.example",
          occurredAt: "2026-07-16T08:00:00.000Z",
        },
        {
          id: "log-2",
          action: "Started",
          status: "DONE",
          entityName: "Demo",
          href: "/projects/demo",
          occurredAt: "2026-07-16T08:00:00.000Z",
        },
      ],
      agentRuns: [],
    }).activityLogs;

    expect(logs).toHaveLength(2);
    expect(logs[0]?.href).toBeNull();
    expect(logs[1]?.href).toBe("/projects/demo");
  });
});

describe("normalizeSearchProject", () => {
  it("trims and caps text fields", () => {
    expect(
      normalizeSearchProject({
        id: "p1",
        slug: " demo ",
        name: " Name ",
        description: "  hello  ",
      }),
    ).toEqual({
      id: "p1",
      slug: "demo",
      name: "Name",
      description: "hello",
    });
  });
});

describe("normalizeSearchAgentRun", () => {
  it("requires valid ids and createdAt", () => {
    expect(
      normalizeSearchAgentRun({
        id: "run-1",
        agentId: "a1",
        agentName: "GIGEL test",
        status: "DONE",
        createdAt: "2026-07-16T11:28:00.000Z",
      }),
    ).toEqual({
      id: "run-1",
      agentId: "a1",
      agentName: "GIGEL test",
      status: "DONE",
      createdAt: "2026-07-16T11:28:00.000Z",
    });
  });
});
