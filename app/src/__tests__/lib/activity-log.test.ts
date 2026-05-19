import { dockerActivityMessage, startOfUtcDay } from "@/lib/activity-log";

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
