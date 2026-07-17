import {
  activityLogHref,
  agentActivityMessage,
  dockerActivityMessage,
  startOfUtcDay,
} from "@/lib/activity-log";

describe("startOfUtcDay", () => {
  it("returns midnight UTC for the given calendar day", () => {
    const instant = new Date("2026-05-18T15:30:00.000Z");
    expect(startOfUtcDay(instant).toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });
});

describe("dockerActivityMessage", () => {
  it("describes start and stop actions", () => {
    expect(dockerActivityMessage("start", "RUNNING")).toBe("Container started");
    expect(dockerActivityMessage("start", "PROVISIONING")).toBe("Container starting");
    expect(dockerActivityMessage("stop", "STOPPED")).toBe("Container stopped");
    expect(dockerActivityMessage("stop", "INACTIVE")).toBe("Environment idle");
  });
});

describe("agentActivityMessage", () => {
  it("describes agent lifecycle and run actions", () => {
    expect(agentActivityMessage("created", "Stock Market")).toBe("Agent created — Stock Market");
    expect(agentActivityMessage("run_started", "Stock Market")).toBe(
      "Agent run started — Stock Market",
    );
    expect(agentActivityMessage("run_completed", "Stock Market")).toBe(
      "Agent run completed — Stock Market",
    );
    expect(agentActivityMessage("run_failed", "Stock Market")).toBe(
      "Agent run failed — Stock Market",
    );
  });
});

describe("activityLogHref", () => {
  it("prefers agent run detail when both ids are present", () => {
    expect(
      activityLogHref({
        agentId: "ag1",
        runId: "run1",
        projectSlug: "demo",
      }),
    ).toBe("/agents/ag1/runs/run1");
  });

  it("links to agents page highlight for agent-only rows", () => {
    expect(activityLogHref({ agentId: "ag1" })).toBe("/agents?highlight=ag1");
  });

  it("links to project workspace for project/docker rows", () => {
    expect(activityLogHref({ projectSlug: "itecify" })).toBe("/projects/itecify");
  });

  it("returns undefined when nothing to link to", () => {
    expect(activityLogHref({})).toBeUndefined();
  });
});
