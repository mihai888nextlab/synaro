import {
  cronStringToScheduleUi,
  getNextScheduledRun,
  scheduleUiToCronString,
  splitScheduleCrons,
} from "@/lib/agents/agent-schedule";

describe("agent-schedule", () => {
  it("converts daily schedule with multiple times on the hour", () => {
    const cron = scheduleUiToCronString({
      enabled: true,
      frequency: "daily",
      times: [
        { hour: 9, minute: 0 },
        { hour: 17, minute: 0 },
      ],
      weekDays: [1],
      monthDays: [1],
      useCustomCron: false,
      customCron: "",
    });
    expect(cron).toBe("0 9,17 * * *");
  });

  it("uses pipe-separated crons for different minutes", () => {
    const cron = scheduleUiToCronString({
      enabled: true,
      frequency: "daily",
      times: [
        { hour: 9, minute: 0 },
        { hour: 17, minute: 30 },
      ],
      weekDays: [1],
      monthDays: [1],
      useCustomCron: false,
      customCron: "",
    });
    expect(cron).toBe("0 9 * * *|30 17 * * *");
  });

  it("round-trips weekly schedule", () => {
    const original = scheduleUiToCronString({
      enabled: true,
      frequency: "weekly",
      times: [{ hour: 8, minute: 30 }],
      weekDays: [1, 3, 5],
      monthDays: [1],
      useCustomCron: false,
      customCron: "",
    });
    const ui = cronStringToScheduleUi(original);
    expect(ui.enabled).toBe(true);
    expect(ui.frequency).toBe("weekly");
    expect(ui.weekDays).toEqual([1, 3, 5]);
    expect(ui.times).toEqual([{ hour: 8, minute: 30 }]);
  });

  it("round-trips monthly schedule", () => {
    const original = scheduleUiToCronString({
      enabled: true,
      frequency: "monthly",
      times: [{ hour: 10, minute: 0 }],
      weekDays: [1],
      monthDays: [1, 15],
      useCustomCron: false,
      customCron: "",
    });
    const ui = cronStringToScheduleUi(original);
    expect(ui.frequency).toBe("monthly");
    expect(ui.monthDays).toEqual([1, 15]);
  });

  it("splits pipe-separated cron expressions", () => {
    expect(splitScheduleCrons("0 9 * * *|30 17 * * *")).toEqual(["0 9 * * *", "30 17 * * *"]);
  });

  it("falls back to custom cron for unsupported patterns", () => {
    const ui = cronStringToScheduleUi("*/15 * * * *");
    expect(ui.useCustomCron).toBe(true);
    expect(ui.customCron).toBe("*/15 * * * *");
  });

  it("converts and round-trips hourly schedule", () => {
    const cron = scheduleUiToCronString({
      enabled: true,
      frequency: "hourly",
      times: [
        { hour: 0, minute: 0 },
        { hour: 0, minute: 30 },
      ],
      weekDays: [1],
      monthDays: [1],
      useCustomCron: false,
      customCron: "",
    });
    expect(cron).toBe("0,30 * * * *");
    const ui = cronStringToScheduleUi(cron);
    expect(ui.enabled).toBe(true);
    expect(ui.frequency).toBe("hourly");
    expect(ui.useCustomCron).toBe(false);
    expect(ui.times.map((t) => t.minute)).toEqual([0, 30]);
  });

  it("parses single-minute hourly cron", () => {
    const ui = cronStringToScheduleUi("0 * * * *");
    expect(ui.frequency).toBe("hourly");
    expect(ui.useCustomCron).toBe(false);
    expect(ui.times).toEqual([{ hour: 0, minute: 0 }]);
  });

  it("computes next daily run in the future", () => {
    const now = new Date("2026-07-15T08:00:00Z");
    const next = getNextScheduledRun("0 9 * * *", now, "Europe/Bucharest");
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
    const label = next!.toLocaleString("en", {
      timeZone: "Europe/Bucharest",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
    expect(label).toContain("9:00");
  });

  it("computes next hourly run in the future", () => {
    const now = new Date("2026-07-15T08:10:00Z");
    const next = getNextScheduledRun("0 * * * *", now, "Europe/Bucharest");
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Bucharest",
      minute: "numeric",
    }).formatToParts(next!);
    expect(parts.find((p) => p.type === "minute")?.value).toBe("0");
  });
});
