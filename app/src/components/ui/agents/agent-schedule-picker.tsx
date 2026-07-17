"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Plus, X } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import {
  cronStringToScheduleUi,
  DEFAULT_SCHEDULE_TIME,
  formatNextScheduledRun,
  formatScheduleTime,
  scheduleUiToCronString,
  type ScheduleFrequency,
  type ScheduleTime,
  type ScheduleUiState,
  validateScheduleUi,
} from "@/lib/agents/agent-schedule";
import { formatTimezoneLabel, getAgentCronTimezone } from "@/lib/agents/agent-cron-timezone";
import { cn } from "@/lib/utils";

const WEEK_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEK_DAY_KEYS = [
  "agents.scheduleDayMon",
  "agents.scheduleDayTue",
  "agents.scheduleDayWed",
  "agents.scheduleDayThu",
  "agents.scheduleDayFri",
  "agents.scheduleDaySat",
  "agents.scheduleDaySun",
] as const;

const DAY_LABEL_KEY: Record<number, (typeof WEEK_DAY_KEYS)[number]> = {
  1: "agents.scheduleDayMon",
  2: "agents.scheduleDayTue",
  3: "agents.scheduleDayWed",
  4: "agents.scheduleDayThu",
  5: "agents.scheduleDayFri",
  6: "agents.scheduleDaySat",
  0: "agents.scheduleDaySun",
};

const FREQUENCIES: ScheduleFrequency[] = ["daily", "weekly", "monthly"];

function timeToInputValue(time: ScheduleTime): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function inputValueToTime(value: string): ScheduleTime {
  const [h, m] = value.split(":");
  return {
    hour: Number.parseInt(h ?? "9", 10) || 0,
    minute: Number.parseInt(m ?? "0", 10) || 0,
  };
}

type AgentSchedulePickerProps = {
  schedule: string;
  onChange: (schedule: string) => void;
  showCustomCron?: boolean;
  onValidationError?: (message: string | null) => void;
};

export function AgentSchedulePicker({
  schedule,
  onChange,
  showCustomCron = false,
  onValidationError,
}: AgentSchedulePickerProps) {
  const { t, locale } = useTranslation();
  const [ui, setUi] = useState<ScheduleUiState>(() => cronStringToScheduleUi(schedule));
  const cronTimezone = useMemo(() => getAgentCronTimezone(), []);
  const timezoneLabel = useMemo(() => formatTimezoneLabel(cronTimezone, locale), [cronTimezone, locale]);

  useEffect(() => {
    setUi(cronStringToScheduleUi(schedule));
  }, [schedule]);

  const validationKey = useMemo(() => validateScheduleUi(ui), [ui]);

  useEffect(() => {
    onValidationError?.(validationKey ? t(`agents.${validationKey}`) : null);
  }, [validationKey, onValidationError, t]);

  const applyUi = (next: ScheduleUiState) => {
    setUi(next);
    if (!next.enabled) {
      onChange("");
      return;
    }
    if (next.useCustomCron) {
      onChange(next.customCron.trim());
      return;
    }
    onChange(scheduleUiToCronString(next));
  };

  const setEnabled = (enabled: boolean) => {
    if (!enabled) {
      applyUi({ ...ui, enabled: false });
      return;
    }
    applyUi({
      ...ui,
      enabled: true,
      times: ui.times.length > 0 ? ui.times : [DEFAULT_SCHEDULE_TIME],
    });
  };

  const setFrequency = (frequency: ScheduleFrequency) => {
    applyUi({ ...ui, enabled: true, frequency, useCustomCron: false });
  };

  const toggleWeekDay = (day: number) => {
    const weekDays = ui.weekDays.includes(day)
      ? ui.weekDays.filter((d) => d !== day)
      : [...ui.weekDays, day];
    applyUi({ ...ui, enabled: true, weekDays, useCustomCron: false });
  };

  const toggleMonthDay = (day: number) => {
    const monthDays = ui.monthDays.includes(day)
      ? ui.monthDays.filter((d) => d !== day)
      : [...ui.monthDays, day];
    applyUi({ ...ui, enabled: true, monthDays, useCustomCron: false });
  };

  const updateTime = (index: number, value: string) => {
    const times = [...ui.times];
    times[index] = inputValueToTime(value);
    applyUi({ ...ui, enabled: true, times, useCustomCron: false });
  };

  const addTime = () => {
    applyUi({
      ...ui,
      enabled: true,
      times: [...ui.times, { hour: 17, minute: 0 }],
      useCustomCron: false,
    });
  };

  const removeTime = (index: number) => {
    if (ui.times.length <= 1) return;
    applyUi({
      ...ui,
      enabled: true,
      times: ui.times.filter((_, i) => i !== index),
      useCustomCron: false,
    });
  };

  const generatedCron = ui.enabled && !ui.useCustomCron ? scheduleUiToCronString(ui) : "";

  return (
    <div className="rounded-xl border border-border/70 bg-muted/15">
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
        <input
          type="checkbox"
          checked={ui.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 rounded border-border/70"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("agents.scheduleEnabled")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("agents.scheduleEnabledHint", { timezone: timezoneLabel })}
          </span>
        </span>
      </label>

      {ui.enabled ? (
        <div className="flex flex-col gap-4 border-t border-border/70 px-4 py-4">
          {ui.useCustomCron && !showCustomCron ? (
            <p className="text-xs text-muted-foreground">{t("agents.scheduleCustomActive")}</p>
          ) : null}

          {!ui.useCustomCron ? (
            <>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((frequency) => (
                  <button
                    key={frequency}
                    type="button"
                    onClick={() => setFrequency(frequency)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                      ui.frequency === frequency
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t(`agents.scheduleFrequency${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`)}
                  </button>
                ))}
              </div>

              {ui.frequency === "weekly" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("agents.scheduleOnDays")}</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAY_ORDER.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekDay(day)}
                        className={cn(
                          "min-w-[2.75rem] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                          ui.weekDays.includes(day)
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {t(DAY_LABEL_KEY[day]!)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {ui.frequency === "monthly" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("agents.scheduleOnMonthDays")}</span>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleMonthDay(day)}
                        className={cn(
                          "size-8 rounded-lg border text-xs font-medium transition",
                          ui.monthDays.includes(day)
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("agents.scheduleAtTimes")}</span>
                <div className="flex flex-col gap-2">
                  {ui.times.map((time, index) => (
                    <div key={`${index}-${time.hour}-${time.minute}`} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={timeToInputValue(time)}
                        onChange={(e) => updateTime(index, e.target.value)}
                        className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatScheduleTime(time, locale)}
                      </span>
                      {ui.times.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeTime(index)}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={t("agents.scheduleRemoveTime")}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addTime}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  {t("agents.scheduleAddTime")}
                </button>
              </div>
            </>
          ) : null}

          {showCustomCron ? (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={ui.useCustomCron}
                  onChange={(e) =>
                    applyUi({
                      ...ui,
                      enabled: true,
                      useCustomCron: e.target.checked,
                      customCron: e.target.checked ? schedule || generatedCron : ui.customCron,
                    })
                  }
                  className="size-3.5 rounded border-border/70"
                />
                {t("agents.scheduleCustomCron")}
              </label>
              {ui.useCustomCron ? (
                <textarea
                  rows={2}
                  value={ui.customCron}
                  onChange={(e) => applyUi({ ...ui, enabled: true, useCustomCron: true, customCron: e.target.value })}
                  placeholder={t("agents.cronPlaceholder")}
                  className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : null}
            </div>
          ) : null}

          {validationKey ? <p className="text-xs text-red-400">{t(`agents.${validationKey}`)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AgentScheduleSummary({
  schedule,
  className,
}: {
  schedule: string | null | undefined;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const summary = useMemo(() => {
    if (!schedule?.trim()) return null;
    const ui = cronStringToScheduleUi(schedule);
    if (!ui.enabled) return null;
    return ui;
  }, [schedule]);

  if (!summary) return null;

  const timesLabel = summary.times.map((time) => formatScheduleTime(time, locale)).join(", ");

  let label = "";
  if (summary.useCustomCron) {
    label = summary.customCron.trim() || schedule!.trim();
  } else if (summary.frequency === "daily") {
    label = t("agents.scheduleSummaryDaily", { times: timesLabel });
  } else if (summary.frequency === "weekly") {
    const days = [...summary.weekDays]
      .sort((a, b) => {
        const order = (d: number) => (d === 0 ? 7 : d);
        return order(a) - order(b);
      })
      .map((d) => t(DAY_LABEL_KEY[d]!))
      .join(", ");
    label = t("agents.scheduleSummaryWeekly", { days, times: timesLabel });
  } else {
    const days = [...summary.monthDays].sort((a, b) => a - b).join(", ");
    label = t("agents.scheduleSummaryMonthly", { days, times: timesLabel });
  }

  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      <CalendarClock className="mr-1 inline size-3 shrink-0 -translate-y-px opacity-70" aria-hidden />
      {label}
    </p>
  );
}

export function AgentNextRunLabel({
  schedule,
  enabled,
  className,
}: {
  schedule: string | null | undefined;
  enabled: boolean;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const cronTimezone = useMemo(() => getAgentCronTimezone(), []);
  const nextLabel = useMemo(() => {
    if (!enabled || !schedule?.trim()) return null;
    return formatNextScheduledRun(schedule, locale, new Date(), cronTimezone);
  }, [enabled, schedule, locale, cronTimezone]);

  if (!nextLabel) return null;

  return (
    <p className={cn("text-xs text-muted-foreground/80", className)}>
      {t("agents.scheduleNextRun", { when: nextLabel, timezone: formatTimezoneLabel(cronTimezone, locale) })}
    </p>
  );
}
