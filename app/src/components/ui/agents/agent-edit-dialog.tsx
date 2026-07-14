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
import {
  agentToFormValues,
  DEFAULT_AGENT_FORM_VALUES,
  type Agent,
  type AgentFormValues,
} from "@/lib/agents/agent-types";

type AgentEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSaved: () => void | Promise<void>;
};

export function AgentEditDialog({ open, onOpenChange, agent, onSaved }: AgentEditDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AgentFormValues>(DEFAULT_AGENT_FORM_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && agent) {
      setForm(agentToFormValues(agent));
      setError("");
    }
  }, [open, agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          systemPrompt: form.systemPrompt,
          tools: form.tools,
          maxSteps: form.maxSteps,
          schedule: form.schedule || undefined,
        }),
      });
      if (res.ok) {
        onOpenChange(false);
        await onSaved();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t("agents.createFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border border-border/70 bg-card p-0 shadow-2xl">
        <div className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            {t("agents.editAgentDialogTitle")}
          </DialogTitle>
        </div>
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
      </DialogContent>
    </Dialog>
  );
}
