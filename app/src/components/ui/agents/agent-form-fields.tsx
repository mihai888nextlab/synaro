"use client";

import { useState } from "react";
import {
  Activity,
  Brain,
  ChevronDown,
  FileText,
  FolderGit2,
  Globe,
  Play,
  Plug,
  Square,
  Users,
  Zap,
} from "lucide-react";

import { AgentSchedulePicker } from "@/components/ui/agents/agent-schedule-picker";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { MODEL_OPTIONS, type AgentFormValues } from "@/lib/agents/agent-types";

export const TOOL_CATALOG = [
  { id: "web_search", labelKey: "agents.toolWebSearch", icon: Globe },
  { id: "http_get", labelKey: "agents.toolHttpGet", icon: Zap },
  { id: "http_post", labelKey: "agents.toolHttpPost", icon: Zap },
  { id: "list_projects", labelKey: "agents.toolListProjects", icon: FolderGit2 },
  { id: "get_project", labelKey: "agents.toolGetProject", icon: FolderGit2 },
  { id: "list_project_runs", labelKey: "agents.toolListProjectRuns", icon: Activity },
  { id: "start_project", labelKey: "agents.toolStartProject", icon: Play },
  { id: "stop_project", labelKey: "agents.toolStopProject", icon: Square },
  { id: "list_files", labelKey: "agents.toolListFiles", icon: FileText },
  { id: "read_file", labelKey: "agents.toolReadFile", icon: FileText },
  { id: "write_file", labelKey: "agents.toolWriteFile", icon: FileText },
  { id: "delete_file", labelKey: "agents.toolDeleteFile", icon: FileText },
  { id: "run_agent", labelKey: "agents.toolRunAgent", icon: Users },
  { id: "remember", labelKey: "agents.toolRemember", icon: Brain },
  { id: "recall", labelKey: "agents.toolRecall", icon: Brain },
  { id: "mcp", labelKey: "agents.toolMcp", icon: Plug },
] as const;

type AgentFormFieldsProps = {
  value: AgentFormValues;
  onChange: (value: AgentFormValues) => void;
  onScheduleValidationError?: (message: string | null) => void;
};

export function AgentFormFields({
  value,
  onChange,
  onScheduleValidationError,
}: AgentFormFieldsProps) {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const setField = <K extends keyof AgentFormValues>(key: K, fieldValue: AgentFormValues[K]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const toggleTool = (toolId: string) => {
    setField(
      "tools",
      value.tools.includes(toolId)
        ? value.tools.filter((id) => id !== toolId)
        : [...value.tools, toolId],
    );
  };

  const isAuto = value.toolMode === "auto";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("agents.name")}</label>
        <input
          required
          value={value.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder={t("agents.namePlaceholder")}
          className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t("agents.description")}{" "}
          <span className="text-muted-foreground/50">{t("agents.optional")}</span>
        </label>
        <input
          value={value.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder={t("agents.descriptionPlaceholder")}
          className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{t("agents.systemPrompt")}</label>
        <textarea
          required
          rows={4}
          value={value.systemPrompt}
          onChange={(e) => setField("systemPrompt", e.target.value)}
          placeholder={t("agents.systemPromptPlaceholder")}
          className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <AgentSchedulePicker
        schedule={value.schedule}
        onChange={(schedule) => setField("schedule", schedule)}
        showCustomCron={advancedOpen}
        onValidationError={onScheduleValidationError}
      />

      <div className="rounded-xl border border-border/70 bg-muted/20">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted/40"
        >
          {t("agents.advancedSettings")}
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition", advancedOpen && "rotate-180")}
          />
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t border-border/70 px-4 py-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isAuto}
                onChange={(e) => setField("toolMode", e.target.checked ? "auto" : "manual")}
                className="mt-0.5 size-4 rounded border-border/70"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("agents.autoTools")}</span>
                <span className="text-xs text-muted-foreground">{t("agents.autoToolsHint")}</span>
              </span>
            </label>

            {!isAuto ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">{t("agents.tools")}</label>
                <div className="flex flex-wrap gap-2">
                  {TOOL_CATALOG.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                        value.tools.includes(tool.id)
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <tool.icon className="size-3" />
                      {t(tool.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("agents.mcpServers")}{" "}
                <span className="text-muted-foreground/50">{t("agents.mcpServersRuntimeHint")}</span>
              </label>
              <textarea
                rows={4}
                value={value.mcpServers}
                onChange={(e) => setField("mcpServers", e.target.value)}
                placeholder={t("agents.mcpServersPlaceholder")}
                className="resize-none rounded-xl border border-border/70 bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agents.model")}</label>
                <div className="relative">
                  <select
                    value={value.model}
                    onChange={(e) => setField("model", e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agents.maxSteps")}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={value.maxSteps}
                  onChange={(e) => setField("maxSteps", Number(e.target.value))}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
