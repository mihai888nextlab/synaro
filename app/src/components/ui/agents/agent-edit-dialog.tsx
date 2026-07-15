"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/components/ui/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { AgentFormFields } from "@/components/ui/agents/agent-form-fields";
import { AgentMemoryPanel } from "@/components/ui/agents/agent-memory-panel";
import { cronStringToScheduleUi, validateScheduleUi } from "@/lib/agents/agent-schedule";
import {
  agentToFormValues,
  buildAgentUpdateBody,
  DEFAULT_AGENT_FORM_VALUES,
  formatAgentApiError,
  parseMcpServers,
  type Agent,
  type AgentFormValues,
} from "@/lib/agents/agent-types";
import { cn } from "@/lib/utils";

type TabKey = "settings" | "memory";

type AgentEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSaved: () => void | Promise<void>;
};

export function AgentEditDialog({ open, onOpenChange, agent, onSaved }: AgentEditDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("settings");
  const [memoryVisited, setMemoryVisited] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [form, setForm] = useState<AgentFormValues>(DEFAULT_AGENT_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("settings");
    setMemoryVisited(false);
    setMemoryCount(null);
  }, [open]);

  useEffect(() => {
    if (!open || !agent) return;

    void (async () => {
      let full = agent;
      try {
        const res = await fetch(`/api/agents/${agent.id}`);
        if (res.ok) full = (await res.json()) as Agent;
      } catch {
        /* use list row */
      }
      setForm(agentToFormValues(full));
      setError("");
    })();
  }, [open, agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    setSaving(true);
    setError("");
    try {
      if (form.mcpServers.trim()) {
        try {
          parseMcpServers(form.mcpServers);
        } catch {
          setError(t("agents.mcpServersInvalid"));
          return;
        }
      }

      const scheduleValidation = validateScheduleUi(cronStringToScheduleUi(form.schedule));
      if (scheduleValidation) {
        setError(t(`agents.${scheduleValidation}`));
        return;
      }

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAgentUpdateBody(form)),
      });
      if (res.ok) {
        onOpenChange(false);
        await onSaved();
      } else {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setError(formatAgentApiError(data.error, t("agents.saveFailed"), data.message));
      }
    } finally {
      setSaving(false);
    }
  };

  const selectMemoryTab = () => {
    setTab("memory");
    setMemoryVisited(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border border-border/70 bg-card p-0 shadow-2xl">
        <div className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            {t("agents.editAgentTitle", { name: agent?.name ?? "" })}
          </DialogTitle>

          <div
            role="tablist"
            aria-label={t("agents.editTabListAriaLabel")}
            className="mt-4 flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "settings"}
              onClick={() => setTab("settings")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                tab === "settings"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("agents.tabSettings")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "memory"}
              onClick={selectMemoryTab}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                tab === "memory"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("agents.tabMemory")}
              {memoryCount !== null && memoryCount > 0 ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {memoryCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {tab === "settings" ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 px-6 py-5">
            <AgentFormFields value={form} onChange={setForm} />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {t("agents.saveChanges")}
              </button>
            </div>
          </form>
        ) : memoryVisited && agent ? (
          <div className="px-6 py-5">
            <AgentMemoryPanel agentId={agent.id} onCountChange={setMemoryCount} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
