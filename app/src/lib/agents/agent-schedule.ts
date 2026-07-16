/**
 * Friendly schedule UI ↔ cron conversion for agent scheduling.
 * Multiple times per day use pipe-separated cron expressions (e.g. `0 9 * * *|30 17 * * *`).
 * Cron times are interpreted in the agent-runner timezone (see agent-cron-timezone.ts).
 */

import {
  getAgentCronTimezone,
  getZonedParts,
  zonedTimeToUtc,
} from "@/lib/agents/agent-cron-timezone";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export type ScheduleTime = {
  hour: number;
  minute: number;
};

export type ScheduleUiState = {
  enabled: boolean;
  frequency: ScheduleFrequency;
  times: ScheduleTime[];
  /** 0 = Sunday … 6 = Saturday (node-cron convention) */
  weekDays: number[];
  /** 1–31 */
  monthDays: number[];
  useCustomCron: boolean;
  customCron: string;
};

export const SCHEDULE_CRON_SEPARATOR = "|";

export const DEFAULT_SCHEDULE_TIME: ScheduleTime = { hour: 9, minute: 0 };

export const DEFAULT_SCHEDULE_UI: ScheduleUiState = {
  enabled: false,
  frequency: "daily",
  times: [DEFAULT_SCHEDULE_TIME],
  weekDays: [1],
  monthDays: [1],
  useCustomCron: false,
  customCron: "",
};

const CRON_PARTS = 5;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeTime(time: ScheduleTime): ScheduleTime {
  return {
    hour: clamp(Math.floor(time.hour), 0, 23),
    minute: clamp(Math.floor(time.minute), 0, 59),
  };
}

function sortTimes(times: ScheduleTime[]): ScheduleTime[] {
  return [...times.map(normalizeTime)].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

function uniqueTimes(times: ScheduleTime[]): ScheduleTime[] {
  const seen = new Set<string>();
  const out: ScheduleTime[] = [];
  for (const t of sortTimes(times)) {
    const key = `${t.hour}:${t.minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function splitScheduleCrons(schedule: string | null | undefined): string[] {
  if (!schedule?.trim()) return [];
  return schedule
    .split(SCHEDULE_CRON_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinScheduleCrons(crons: string[]): string {
  return crons.filter(Boolean).join(SCHEDULE_CRON_SEPARATOR);
}

function parseCronPart(part: string): number[] {
  return part
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

type ParsedCron = {
  minute: number[];
  hour: number[];
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
};

function parseSingleCron(cron: string): ParsedCron | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== CRON_PARTS) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null;

  const minuteNums = parseCronPart(minute);
  const hourNums = parseCronPart(hour);
  if (minuteNums.length === 0 || hourNums.length === 0) return null;
  if (minuteNums.some((m) => m < 0 || m > 59)) return null;
  if (hourNums.some((h) => h < 0 || h > 23)) return null;

  return { minute: minuteNums, hour: hourNums, dayOfMonth, month, dayOfWeek };
}

function timesFromParsed(parsed: ParsedCron): ScheduleTime[] {
  const times: ScheduleTime[] = [];
  for (const minute of parsed.minute) {
    for (const hour of parsed.hour) {
      times.push({ hour, minute });
    }
  }
  return uniqueTimes(times);
}

function isDaily(parsed: ParsedCron): boolean {
  return parsed.dayOfMonth === "*" && parsed.month === "*" && parsed.dayOfWeek === "*";
}

function isWeekly(parsed: ParsedCron): boolean {
  return parsed.dayOfMonth === "*" && parsed.month === "*" && parsed.dayOfWeek !== "*";
}

function isMonthly(parsed: ParsedCron): boolean {
  return parsed.dayOfMonth !== "*" && parsed.month === "*" && parsed.dayOfWeek === "*";
}

/** Convert UI state to one or more cron expressions. */
export function scheduleUiToCrons(state: ScheduleUiState): string[] {
  if (!state.enabled) return [];

  if (state.useCustomCron) {
    return splitScheduleCrons(state.customCron);
  }

  const times = uniqueTimes(state.times.length > 0 ? state.times : [DEFAULT_SCHEDULE_TIME]);
  const byMinute = new Map<number, number[]>();

  for (const time of times) {
    const list = byMinute.get(time.minute) ?? [];
    list.push(time.hour);
    byMinute.set(time.minute, list);
  }

  const crons: string[] = [];

  for (const [minute, hours] of [...byMinute.entries()].sort(([a], [b]) => a - b)) {
    const hourList = [...new Set(hours)].sort((a, b) => a - b).join(",");
    if (state.frequency === "daily") {
      crons.push(`${minute} ${hourList} * * *`);
    } else if (state.frequency === "weekly") {
      const days = state.weekDays.length > 0 ? [...state.weekDays].sort((a, b) => a - b) : [1];
      crons.push(`${minute} ${hourList} * * ${days.join(",")}`);
    } else {
      const days = state.monthDays.length > 0 ? [...state.monthDays].sort((a, b) => a - b) : [1];
      crons.push(`${minute} ${hourList} ${days.join(",")} * *`);
    }
  }

  return crons;
}

export function scheduleUiToCronString(state: ScheduleUiState): string {
  return joinScheduleCrons(scheduleUiToCrons(state));
}

/** Parse stored cron into UI state; unknown patterns fall back to custom cron mode. */
export function cronStringToScheduleUi(schedule: string | null | undefined): ScheduleUiState {
  if (!schedule?.trim()) {
    return { ...DEFAULT_SCHEDULE_UI, enabled: false };
  }

  const crons = splitScheduleCrons(schedule);
  if (crons.length === 0) {
    return { ...DEFAULT_SCHEDULE_UI, enabled: false };
  }

  const parsedList = crons.map(parseSingleCron);
  if (parsedList.some((p) => p === null)) {
    return {
      ...DEFAULT_SCHEDULE_UI,
      enabled: true,
      useCustomCron: true,
      customCron: schedule.trim(),
    };
  }

  const parsed = parsedList as ParsedCron[];
  const allDaily = parsed.every(isDaily);
  const allWeekly = parsed.every(isWeekly);
  const allMonthly = parsed.every(isMonthly);

  if (!allDaily && !allWeekly && !allMonthly) {
    return {
      ...DEFAULT_SCHEDULE_UI,
      enabled: true,
      useCustomCron: true,
      customCron: schedule.trim(),
    };
  }

  const frequency: ScheduleFrequency = allDaily ? "daily" : allWeekly ? "weekly" : "monthly";
  const times = uniqueTimes(parsed.flatMap((p) => timesFromParsed(p)));

  let weekDays = [1];
  if (frequency === "weekly") {
    weekDays = [...new Set(parsed.flatMap((p) => parseCronPart(p.dayOfWeek)))].sort((a, b) => a - b);
  }

  let monthDays = [1];
  if (frequency === "monthly") {
    monthDays = [...new Set(parsed.flatMap((p) => parseCronPart(p.dayOfMonth)))].sort((a, b) => a - b);
  }

  return {
    enabled: true,
    frequency,
    times: times.length > 0 ? times : [DEFAULT_SCHEDULE_TIME],
    weekDays,
    monthDays,
    useCustomCron: false,
    customCron: "",
  };
}

export function formatScheduleTime(time: ScheduleTime, locale?: string): string {
  const date = new Date();
  date.setHours(time.hour, time.minute, 0, 0);
  return date.toLocaleTimeString(locale ?? undefined, { hour: "numeric", minute: "2-digit" });
}

export type ScheduleSummary =
  | { kind: "daily"; times: ScheduleTime[] }
  | { kind: "weekly"; times: ScheduleTime[]; weekDays: number[] }
  | { kind: "monthly"; times: ScheduleTime[]; monthDays: number[] }
  | { kind: "custom"; cron: string };

export function getScheduleSummary(schedule: string | null | undefined): ScheduleSummary | null {
  if (!schedule?.trim()) return null;
  const ui = cronStringToScheduleUi(schedule);
  if (!ui.enabled) return null;
  if (ui.useCustomCron) return { kind: "custom", cron: ui.customCron.trim() || schedule.trim() };
  if (ui.frequency === "daily") return { kind: "daily", times: ui.times };
  if (ui.frequency === "weekly") return { kind: "weekly", times: ui.times, weekDays: ui.weekDays };
  return { kind: "monthly", times: ui.times, monthDays: ui.monthDays };
}

function nextDailyRun(time: ScheduleTime, now: Date, timeZone: string): Date {
  const parts = getZonedParts(now, timeZone);
  let candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, time.hour, time.minute, timeZone);
  if (candidate.getTime() <= now.getTime()) {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    const tParts = getZonedParts(tomorrow, timeZone);
    candidate = zonedTimeToUtc(tParts.year, tParts.month, tParts.day, time.hour, time.minute, timeZone);
  }
  return candidate;
}

function nextWeeklyRun(time: ScheduleTime, weekDays: number[], now: Date, timeZone: string): Date {
  const sortedDays = [...weekDays].sort((a, b) => a - b);
  let best: Date | null = null;

  for (let offset = 0; offset < 8; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const parts = getZonedParts(probe, timeZone);
    if (!sortedDays.includes(parts.dayOfWeek)) continue;

    const candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, time.hour, time.minute, timeZone);
    if (candidate.getTime() <= now.getTime()) continue;
    best = candidate;
    break;
  }

  if (best) return best;

  for (let offset = 1; offset <= 14; offset += 1) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const parts = getZonedParts(probe, timeZone);
    if (!sortedDays.includes(parts.dayOfWeek)) continue;
    return zonedTimeToUtc(parts.year, parts.month, parts.day, time.hour, time.minute, timeZone);
  }

  return nextDailyRun(time, now, timeZone);
}

function nextMonthlyRun(time: ScheduleTime, monthDays: number[], now: Date, timeZone: string): Date {
  const sortedDays = [...monthDays].sort((a, b) => a - b);
  let best: Date | null = null;

  for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
    const probe = new Date(now.getTime() + monthOffset * 28 * 86_400_000);
    const baseParts = getZonedParts(probe, timeZone);

    for (const dom of sortedDays) {
      if (dom < 1 || dom > 31) continue;
      const candidate = zonedTimeToUtc(baseParts.year, baseParts.month, dom, time.hour, time.minute, timeZone);
      if (candidate.getTime() <= now.getTime()) continue;
      if (getZonedParts(candidate, timeZone).day !== dom) continue;
      if (best === null || candidate.getTime() < best.getTime()) {
        best = candidate;
      }
    }

    if (best) break;
  }

  return best ?? nextDailyRun(time, now, timeZone);
}

function nextRunForSingleCron(cron: string, now: Date, timeZone: string): Date | null {
  const parsed = parseSingleCron(cron);
  if (!parsed) return null;
  const times = timesFromParsed(parsed);
  if (times.length === 0) return null;

  const candidates: Date[] = [];

  for (const time of times) {
    if (isDaily(parsed)) {
      candidates.push(nextDailyRun(time, now, timeZone));
    } else if (isWeekly(parsed)) {
      const days = parseCronPart(parsed.dayOfWeek);
      candidates.push(nextWeeklyRun(time, days.length ? days : [1], now, timeZone));
    } else if (isMonthly(parsed)) {
      const days = parseCronPart(parsed.dayOfMonth);
      candidates.push(nextMonthlyRun(time, days.length ? days : [1], now, timeZone));
    }
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

/** Next run time in the agent-runner timezone, or null if unparseable/disabled. */
export function getNextScheduledRun(
  schedule: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = getAgentCronTimezone(),
): Date | null {
  const crons = splitScheduleCrons(schedule);
  if (crons.length === 0) return null;

  const candidates = crons
    .map((cron) => nextRunForSingleCron(cron, now, timeZone))
    .filter((d): d is Date => d !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

export function formatNextScheduledRun(
  schedule: string | null | undefined,
  locale?: string,
  now: Date = new Date(),
  timeZone: string = getAgentCronTimezone(),
): string | null {
  const next = getNextScheduledRun(schedule, now, timeZone);
  if (!next) return null;
  return next.toLocaleString(locale ?? undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function validateScheduleUi(state: ScheduleUiState): string | null {
  if (!state.enabled) return null;
  if (state.useCustomCron) {
    const crons = splitScheduleCrons(state.customCron);
    if (crons.length === 0) return "scheduleCustomRequired";
    return null;
  }
  if (state.times.length === 0) return "scheduleTimeRequired";
  if (state.frequency === "weekly" && state.weekDays.length === 0) return "scheduleWeekDayRequired";
  if (state.frequency === "monthly" && state.monthDays.length === 0) return "scheduleMonthDayRequired";
  return null;
}
