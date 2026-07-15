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

  it("computes next daily run in the future", () => {
    const now = new Date("2026-07-15T08:00:00");
    const next = getNextScheduledRun("0 9 * * *", now);
    expect(next?.getHours()).toBe(9);
    expect(next?.getMinutes()).toBe(0);
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });
});
