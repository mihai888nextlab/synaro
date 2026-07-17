"use client";

import { useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";

import { useAgentBackgroundRuns } from "@/components/ui/agent-background-runs";
import {
  AgentRunComposer,
  buildAgentRunInput,
} from "@/components/ui/agent-run-composer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/ui/locale-provider";
import type { Agent } from "@/lib/agents/agent-types";
import { markVoiceTriggeredRun } from "@/lib/speech/voice-triggered-runs";

type AgentTriggerDialogProps = {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onTriggered?: () => void;
};

export function AgentTriggerDialog({
  agent,
  open,
  onOpenChange,
  onBusyChange,
  onTriggered,
}: AgentTriggerDialogProps) {
  const { t } = useTranslation();
  const { refreshSoon } = useAgentBackgroundRuns();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const voiceInitiatedRef = useRef(false);

  const reset = () => {
    setInput("");
    setAttachments([]);
    voiceInitiatedRef.current = false;
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleTrigger = async (options?: { fromVoice?: boolean; input?: string }) => {
    if (!agent) return;
    const voiceInitiated = options?.fromVoice || voiceInitiatedRef.current;
    setSubmitting(true);
    onBusyChange?.(true);
    onOpenChange(false);
    try {
      const inputText = options?.input ?? input;
      const runInput = await buildAgentRunInput(inputText, attachments);
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: runInput }),
      });
      if (res.ok) {
        const data = (await res.json()) as { runId?: string };
        if (voiceInitiated && data.runId) {
          markVoiceTriggeredRun(data.runId);
        }
      }
      refreshSoon();
      onTriggered?.();
    } finally {
      setSubmitting(false);
      onBusyChange?.(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-onboarding="agent-trigger-dialog"
        className="max-w-md rounded-2xl border border-border/70 bg-card p-0 shadow-2xl"
      >
        <div className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            {t("agents.runAgentTitle", { name: agent?.name ?? "" })}
          </DialogTitle>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("agents.input")}{" "}
              <span className="text-muted-foreground/50">{t("agents.optional")}</span>
            </label>
            <AgentRunComposer
              value={input}
              onChange={setInput}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              placeholder={t("agents.inputPlaceholder")}
              voiceInitiatedRef={voiceInitiatedRef}
              onVoiceUtteranceEnd={(text) => {
                if (text.trim()) void handleTrigger({ fromVoice: true, input: text });
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleTrigger()}
              disabled={submitting || !agent}
              className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              {t("agents.runAgent")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
