"use client";

import { CheckCircle2, Clock, KeyRound, Loader2, StopCircle, XCircle } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export function AgentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { labelKey: string; cls: string; icon: React.ReactNode }> = {
    PENDING: {
      labelKey: "agents.statusPending",
      cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      icon: <Clock className="size-3" />,
    },
    RUNNING: {
      labelKey: "agents.statusRunning",
      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    NEEDS_INPUT: {
      labelKey: "agents.statusNeedsInput",
      cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: <KeyRound className="size-3" />,
    },
    DONE: {
      labelKey: "agents.statusDone",
      cls: "bg-green-500/10 text-green-400 border-green-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    FAILED: {
      labelKey: "agents.statusFailed",
      cls: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: <XCircle className="size-3" />,
    },
    CANCELLED: {
      labelKey: "agents.statusCancelled",
      cls: "bg-muted text-muted-foreground border-border/70",
      icon: <StopCircle className="size-3" />,
    },
  };
  const s = map[status] ?? {
    labelKey: status,
    cls: "bg-muted text-muted-foreground border-border/70",
    icon: null,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        s.cls,
      )}
    >
      {s.icon}
      {map[status] ? t(s.labelKey) : status}
    </span>
  );
}
