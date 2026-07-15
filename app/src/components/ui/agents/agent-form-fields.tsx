"use client";

import { Globe, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import type { AgentFormValues } from "@/lib/agents/agent-types";

export const TOOL_OPTION_IDS = [
  { id: "web_search", labelKey: "agents.toolWebSearch", icon: Globe },
  { id: "http_get", labelKey: "agents.toolHttpGet", icon: Zap },
  { id: "http_post", labelKey: "agents.toolHttpPost", icon: Zap },
] as const;

type AgentFormFieldsProps = {
  value: AgentFormValues;
  onChange: (value: AgentFormValues) => void;
};

export function AgentFormFields({ value, onChange }: AgentFormFieldsProps) {
  const { t } = useTranslation();

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
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">{t("agents.tools")}</label>
        <div className="flex flex-wrap gap-2">
          {TOOL_OPTION_IDS.map((tool) => (
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
      <div className="grid grid-cols-2 gap-3">
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("agents.cronSchedule")}{" "}
            <span className="text-muted-foreground/50">{t("agents.optional")}</span>
          </label>
          {/* Runner picks up schedule changes on restart only (no cron reload in v1). */}
          <input
            value={value.schedule}
            onChange={(e) => setField("schedule", e.target.value)}
            placeholder={t("agents.cronPlaceholder")}
            className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
    </>
  );
}
