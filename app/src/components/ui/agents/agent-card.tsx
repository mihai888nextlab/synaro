"use client";

import { useState } from "react";
import { Bot, Link2, Loader2, MoreVertical, Pencil, Play, Trash2 } from "lucide-react";
import { AgentShareLink } from "@/components/ui/agent-share-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";import { useTranslation } from "@/components/ui/locale-provider";
import type { Agent } from "@/lib/agents/agent-types";

function agentToolsLabel(
  agent: Agent,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const count = agent.tools.length;
  return count === 1 ? t("agents.toolsCountOne", { count }) : t("agents.toolsCountMany", { count });
}

function AgentEnableToggle({
  enabled,
  saving,
  onToggle,
}: {
  enabled: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = enabled ? t("agents.statusEnabled") : t("agents.statusDisabled");
  const title = enabled ? t("agents.disableAgent") : t("agents.enableAgent");

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      title={title}
      aria-label={title}
      aria-pressed={enabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase transition disabled:opacity-60",
        enabled
          ? "border-emerald-200/70 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-400 dark:hover:bg-emerald-950/75"
          : "border-border bg-muted text-muted-foreground hover:bg-accent dark:border-border/80 dark:bg-muted/30",
      )}
    >
      {saving ? (
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
      ) : enabled ? (
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
      ) : null}
      {label}
    </button>
  );
}

export function AgentCard({
  agent,
  onTrigger,
  onDelete,
  onViewRuns,
  onEdit,
  onEnabledChange,
  triggering,
}: {
  agent: Agent;
  onTrigger: (id: string) => void;
  onDelete: (id: string) => void;
  onViewRuns: (agent: Agent) => void;
  onEdit: (agent: Agent) => void;
  onEnabledChange: (agentId: string, enabled: boolean) => Promise<void>;
  triggering: boolean;
}) {
  const { t } = useTranslation();
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const runDisabled = !agent.enabled || triggering;

  const handleToggleEnabled = () => {
    void (async () => {
      setTogglingEnabled(true);
      try {
        await onEnabledChange(agent.id, !agent.enabled);
      } finally {
        setTogglingEnabled(false);
      }
    })();
  };

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm shadow-black/[0.06] transition-colors sm:p-[1.125rem]",
        "hover:border-border hover:shadow-black/[0.08] dark:border-border/55 dark:bg-card/90 dark:shadow-black/20 dark:hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition group-hover:bg-muted dark:border-border/60 dark:bg-muted/60"
          aria-hidden
        >
          <Bot className="size-4 shrink-0" />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <AgentEnableToggle
            enabled={agent.enabled}
            saving={togglingEnabled}
            onToggle={handleToggleEnabled}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-lg p-0 leading-none text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:block"
                aria-label={t("agents.moreOptionsFor", { name: agent.name })}
              >
                <MoreVertical className="size-4 shrink-0" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/70 p-1" sideOffset={6}>
              <DropdownMenuItem
                className="cursor-pointer rounded-lg"
                onSelect={() => onEdit(agent)}
              >
                <span className="flex items-center gap-2">
                  <Pencil className="size-4 shrink-0" aria-hidden />
                  {t("agents.editAgent")}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer rounded-lg"
                onSelect={() => setShareOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Link2 className="size-4 shrink-0" aria-hidden />
                  {t("agentShare.share")}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                className="cursor-pointer rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  if (!window.confirm(t("agents.deleteConfirm"))) return;
                  onDelete(agent.id);
                }}
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="size-4 shrink-0" aria-hidden />
                  {t("agents.deleteAgent")}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AgentShareLink
            agentId={agent.id}
            open={shareOpen}
            onOpenChange={setShareOpen}
            hideTrigger
          />
        </div>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-semibold leading-snug tracking-tight text-foreground">
          {agent.name}
        </span>

        <hr className="my-4 border-0 border-t border-border/60 dark:border-border/45" />

        <div className="flex items-end justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">{agentToolsLabel(agent, t)}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onTrigger(agent.id)}
              disabled={runDisabled}
              title={!agent.enabled ? t("agents.agentDisabledRunTooltip") : undefined}
              className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {triggering ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3" aria-hidden />
              )}
              {t("agents.run")}
            </button>
            <button
              type="button"
              onClick={() => onViewRuns(agent)}
              className="inline-flex items-center gap-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <span>{t("agents.runs")}</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
