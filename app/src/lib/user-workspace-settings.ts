import {
  DEFAULT_AGENT_FORM_VALUES,
  MODEL_OPTIONS,
  type AgentFormValues,
  type AgentToolMode,
} from "@/lib/agents/agent-types";

export const IDLE_STOP_MINUTE_OPTIONS = [15, 30, 60, 120] as const;

export type UserWorkspaceSettings = {
  idleStopMinutes: number;
  defaultAgentModel: string;
  defaultAgentMaxSteps: number;
  defaultAgentToolMode: AgentToolMode;
};

export type UserWorkspaceSettingsPatch = Partial<UserWorkspaceSettings>;

const MIN_AGENT_STEPS = 1;
const MAX_AGENT_STEPS = 50;

export function resolveIdleStopMinutes(stored: number | null | undefined): number {
  if (stored === 0) return 0;
  if (typeof stored === "number" && stored > 0) return stored;
  const envDefault = Number(process.env.IDLE_STOP_MINUTES ?? "30");
  return Math.max(1, Number.isFinite(envDefault) ? envDefault : 30);
}

export function parseWorkspaceSettingsFromUser(user: {
  idleStopMinutes?: number | null;
  defaultAgentModel?: string | null;
  defaultAgentMaxSteps?: number | null;
  defaultAgentToolMode?: string | null;
}): UserWorkspaceSettings {
  const model =
    user.defaultAgentModel && MODEL_OPTIONS.includes(user.defaultAgentModel as (typeof MODEL_OPTIONS)[number])
      ? user.defaultAgentModel
      : DEFAULT_AGENT_FORM_VALUES.model;

  const maxSteps =
    typeof user.defaultAgentMaxSteps === "number" &&
    user.defaultAgentMaxSteps >= MIN_AGENT_STEPS &&
    user.defaultAgentMaxSteps <= MAX_AGENT_STEPS
      ? user.defaultAgentMaxSteps
      : DEFAULT_AGENT_FORM_VALUES.maxSteps;

  const toolMode: AgentToolMode =
    user.defaultAgentToolMode === "manual" ? "manual" : "auto";

  return {
    idleStopMinutes: resolveIdleStopMinutes(user.idleStopMinutes),
    defaultAgentModel: model,
    defaultAgentMaxSteps: maxSteps,
    defaultAgentToolMode: toolMode,
  };
}

export function agentFormValuesFromWorkspaceSettings(
  settings: UserWorkspaceSettings,
): Pick<AgentFormValues, "model" | "maxSteps" | "toolMode"> {
  return {
    model: settings.defaultAgentModel,
    maxSteps: settings.defaultAgentMaxSteps,
    toolMode: settings.defaultAgentToolMode,
  };
}

export function validateWorkspaceSettingsPatch(
  patch: UserWorkspaceSettingsPatch,
): { ok: true; data: UserWorkspaceSettingsPatch } | { ok: false; error: string } {
  const data: UserWorkspaceSettingsPatch = {};

  if (patch.idleStopMinutes !== undefined) {
    if (
      patch.idleStopMinutes !== 0 &&
      !IDLE_STOP_MINUTE_OPTIONS.includes(
        patch.idleStopMinutes as (typeof IDLE_STOP_MINUTE_OPTIONS)[number],
      )
    ) {
      return { ok: false, error: "Invalid idle stop duration." };
    }
    data.idleStopMinutes = patch.idleStopMinutes;
  }

  if (patch.defaultAgentModel !== undefined) {
    if (
      !MODEL_OPTIONS.includes(patch.defaultAgentModel as (typeof MODEL_OPTIONS)[number])
    ) {
      return { ok: false, error: "Invalid agent model." };
    }
    data.defaultAgentModel = patch.defaultAgentModel;
  }

  if (patch.defaultAgentMaxSteps !== undefined) {
    if (
      !Number.isInteger(patch.defaultAgentMaxSteps) ||
      patch.defaultAgentMaxSteps < MIN_AGENT_STEPS ||
      patch.defaultAgentMaxSteps > MAX_AGENT_STEPS
    ) {
      return { ok: false, error: "Invalid max steps." };
    }
    data.defaultAgentMaxSteps = patch.defaultAgentMaxSteps;
  }

  if (patch.defaultAgentToolMode !== undefined) {
    if (patch.defaultAgentToolMode !== "auto" && patch.defaultAgentToolMode !== "manual") {
      return { ok: false, error: "Invalid tool mode." };
    }
    data.defaultAgentToolMode = patch.defaultAgentToolMode;
  }

  return { ok: true, data };
}
