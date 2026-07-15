"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, LayoutDashboard, Loader2, Timer } from "lucide-react";
import type { GetServerSideProps } from "next";

import {
  SettingsLayout,
  SettingsSection,
} from "@/components/ui/settings/settings-layout";
import { useTranslation } from "@/components/ui/locale-provider";
import { MODEL_OPTIONS, type AgentToolMode } from "@/lib/agents/agent-types";
import {
  IDLE_STOP_MINUTE_OPTIONS,
  type UserWorkspaceSettings,
} from "@/lib/user-workspace-settings";
import { requireAuth } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

export default function WorkspaceSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<UserWorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [resettingDashboard, setResettingDashboard] = useState(false);
  const [dashboardMessage, setDashboardMessage] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/workspace-settings");
      const data = (await res.json().catch(() => ({}))) as UserWorkspaceSettings & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : t("settings.workspaceLoadFailed"),
        );
      }
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.workspaceLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const patchSettings = async (patch: Partial<UserWorkspaceSettings>, field: string) => {
    setSavingField(field);
    setError("");
    try {
      const res = await fetch("/api/account/workspace-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as UserWorkspaceSettings | { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : t("settings.workspaceSaveFailed"),
        );
      }
      setSettings(data as UserWorkspaceSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.workspaceSaveFailed"));
    } finally {
      setSavingField(null);
    }
  };

  const handleResetDashboard = async () => {
    if (!window.confirm(t("settings.dashboardResetConfirm"))) return;
    setResettingDashboard(true);
    setDashboardMessage("");
    setError("");
    try {
      const res = await fetch("/api/account/dashboard-layout?reset=1", { method: "POST" });
      if (!res.ok) throw new Error(t("settings.dashboardResetFailed"));
      setDashboardMessage(t("settings.dashboardResetDone"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.dashboardResetFailed"));
    } finally {
      setResettingDashboard(false);
    }
  };

  const idleEnabled = (settings?.idleStopMinutes ?? 30) > 0;

  return (
    <SettingsLayout
      title={t("settings.workspaceTitle")}
      description={t("settings.workspaceDescription")}
    >
      {loading && !settings ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : settings ? (
        <div className="flex flex-col gap-6">
          <SettingsSection
            icon={Timer}
            title={t("settings.idleStopTitle")}
            description={t("settings.idleStopDescription")}
          >
            <div className="flex flex-col gap-4">
              <label className="inline-flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={idleEnabled}
                  disabled={savingField === "idleStopMinutes"}
                  onChange={(e) =>
                    void patchSettings(
                      { idleStopMinutes: e.target.checked ? 30 : 0 },
                      "idleStopMinutes",
                    )
                  }
                  className="size-4 rounded border-border"
                />
                <span className="text-sm text-foreground">{t("settings.idleStopEnabled")}</span>
              </label>

              {idleEnabled ? (
                <div className="flex flex-wrap gap-2">
                  {IDLE_STOP_MINUTE_OPTIONS.map((minutes) => {
                    const active = settings.idleStopMinutes === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        disabled={savingField === "idleStopMinutes"}
                        onClick={() => void patchSettings({ idleStopMinutes: minutes }, "idleStopMinutes")}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-medium transition",
                          active
                            ? "border-border bg-muted text-foreground"
                            : "border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {t("settings.idleStopMinutes", { count: minutes })}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={Bot}
            title={t("settings.agentDefaultsTitle")}
            description={t("settings.agentDefaultsDescription")}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("agents.model")}
                </label>
                <select
                  value={settings.defaultAgentModel}
                  disabled={savingField === "defaultAgentModel"}
                  onChange={(e) =>
                    void patchSettings({ defaultAgentModel: e.target.value }, "defaultAgentModel")
                  }
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("agents.maxSteps")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.defaultAgentMaxSteps}
                  disabled={savingField === "defaultAgentMaxSteps"}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value)) return;
                    void patchSettings({ defaultAgentMaxSteps: value }, "defaultAgentMaxSteps");
                  }}
                  className="w-full max-w-[8rem] rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("settings.defaultToolMode")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(["auto", "manual"] as AgentToolMode[]).map((mode) => {
                    const active = settings.defaultAgentToolMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={savingField === "defaultAgentToolMode"}
                        onClick={() =>
                          void patchSettings({ defaultAgentToolMode: mode }, "defaultAgentToolMode")
                        }
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-medium capitalize transition",
                          active
                            ? "border-border bg-muted text-foreground"
                            : "border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {mode === "auto" ? t("settings.defaultToolModeAuto") : t("settings.defaultToolModeManual")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={LayoutDashboard}
            title={t("settings.dashboardTitle")}
            description={t("settings.dashboardDescription")}
          >
            <button
              type="button"
              onClick={() => void handleResetDashboard()}
              disabled={resettingDashboard}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {resettingDashboard ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t("settings.dashboardReset")}
            </button>
            {dashboardMessage ? (
              <p className="mt-3 text-sm text-emerald-500">{dashboardMessage}</p>
            ) : null}
          </SettingsSection>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
