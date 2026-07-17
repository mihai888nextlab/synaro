export const DEFAULT_AGENT_CRON_TIMEZONE = "Europe/Bucharest";

/** Must match agent-runner `AGENT_CRON_TIMEZONE` (exposed to the browser via NEXT_PUBLIC_*). */
export function getAgentCronTimezone(): string {
  const fromEnv = process.env.NEXT_PUBLIC_AGENT_CRON_TIMEZONE?.trim();
  return fromEnv || DEFAULT_AGENT_CRON_TIMEZONE;
}

export function formatTimezoneLabel(timezone: string, locale?: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale ?? "en", {
      timeZone: timezone,
      timeZoneName: "shortGeneric",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ? `${timezone} (${name})` : timezone;
  } catch {
    return timezone;
  }
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    dayOfWeek: WEEKDAY_MAP[get("weekday")] ?? 0,
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const { type, value } of parts) {
    if (type !== "literal") map[type] = value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** Wall-clock time in `timeZone` → UTC `Date`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = getTimezoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}
