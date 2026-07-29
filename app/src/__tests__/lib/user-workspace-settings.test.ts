/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";

import {
  agentFormValuesFromWorkspaceSettings,
  parseWorkspaceSettingsFromUser,
  validateWorkspaceSettingsPatch,
} from "@/lib/user-workspace-settings";

describe("user-workspace-settings", () => {
  it("parses defaults when user fields are null", () => {
    const settings = parseWorkspaceSettingsFromUser({});
    expect(settings.defaultAgentModel).toBe("kimi-k2.7-code");
    expect(settings.defaultAgentMaxSteps).toBe(20);
    expect(settings.defaultAgentToolMode).toBe("auto");
    expect(settings.idleStopMinutes).toBe(30);
  });

  it("treats idleStopMinutes 0 as disabled", () => {
    const settings = parseWorkspaceSettingsFromUser({ idleStopMinutes: 0 });
    expect(settings.idleStopMinutes).toBe(0);
  });

  it("validates patch fields", () => {
    expect(validateWorkspaceSettingsPatch({ idleStopMinutes: 45 }).ok).toBe(false);
    expect(validateWorkspaceSettingsPatch({ idleStopMinutes: 60 }).ok).toBe(true);
    expect(validateWorkspaceSettingsPatch({ defaultAgentMaxSteps: 99 }).ok).toBe(false);
  });

  it("maps settings to agent form defaults", () => {
    const values = agentFormValuesFromWorkspaceSettings({
      idleStopMinutes: 30,
      defaultAgentModel: "moonshot-v1-8k",
      defaultAgentMaxSteps: 15,
      defaultAgentToolMode: "manual",
    });
    expect(values).toEqual({
      model: "moonshot-v1-8k",
      maxSteps: 15,
      toolMode: "manual",
    });
  });
});
