import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

export type SynaroAgentCardModel = {
  id: string;
  name: string;
  description: string;
  toolsCount: number;
  enabled: boolean;
  createdRelative: string;
};

function agentToolsLabel(
  count: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return count === 1 ? t("agents.toolsCountOne", { count }) : t("agents.toolsCountMany", { count });
}

export function SynaroAgentStatusPill({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  if (enabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
          "border-emerald-200/70 bg-emerald-50 text-emerald-700",
          "dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-400",
        )}
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
          aria-hidden
        />
        {t("agents.statusEnabled")}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase",
        "border-border bg-muted text-muted-foreground dark:border-border/80 dark:bg-muted/30",
      )}
    >
      {t("agents.statusDisabled")}
    </span>
  );
}

export function SynaroAgentCard({
  agent,
  variant = "default",
}: {
  agent: SynaroAgentCardModel;
  variant?: "default" | "embedded";
}) {
  const { t } = useTranslation();
  const href = "/agents";

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl text-left transition-colors",
        variant === "embedded"
          ? "overflow-hidden border-0 bg-muted/20 p-4 shadow-none max-sm:p-3 hover:bg-muted/30 dark:bg-muted/10 dark:hover:bg-muted/20 sm:p-[1.125rem]"
          : "border border-border/70 bg-card p-4 shadow-sm shadow-black/[0.06] sm:p-[1.125rem] hover:border-border hover:shadow-black/[0.08] dark:border-border/55 dark:bg-card/90 dark:shadow-black/20 dark:hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition group-hover:bg-muted",
            "dark:border-border/60 dark:bg-muted/60",
            variant === "embedded" && "max-sm:h-8 max-sm:w-8",
          )}
          aria-hidden
        >
          <Bot className={cn("size-4 shrink-0", variant === "embedded" && "max-sm:size-3.5")} />
        </div>
        <SynaroAgentStatusPill enabled={agent.enabled} />
      </div>

      <Link
        href={href}
        data-onboarding="agent-card-link"
        aria-label={t("agents.openAgent", { name: agent.name })}
        className={cn(
          "mt-4 block min-w-0 flex-1 rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
          variant === "embedded" && "max-sm:mt-2",
        )}
      >
        <span
          className={cn(
            "block font-semibold leading-snug tracking-tight text-foreground",
            variant === "embedded"
              ? "truncate text-[0.9375rem] sm:text-[1.0625rem]"
              : "text-[1.0625rem]",
          )}
        >
          {agent.name}
        </span>
        {variant === "embedded" ? (
          <p className="mt-1 text-[0.65rem] text-muted-foreground sm:hidden">{agent.createdRelative}</p>
        ) : null}
        {agent.description ? (
          <p
            className={cn(
              "mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground",
              variant === "embedded" && "hidden sm:block",
            )}
          >
            {agent.description}
          </p>
        ) : null}

        <hr
          className={cn(
            "my-4 border-0 border-t border-border/60 dark:border-border/45",
            variant === "embedded" && "hidden sm:block",
            !agent.description && variant === "embedded" && "sm:mt-4",
          )}
        />

        <div
          className={cn(
            "flex items-end justify-between gap-3 text-xs",
            variant === "embedded" && "hidden sm:flex",
          )}
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {t("agents.createdRelative", {
              count: agent.toolsCount,
              relative: agent.createdRelative,
            })}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground transition group-hover:text-foreground">
            <span className="font-normal">{t("agents.open")}</span>
            <span aria-hidden>→</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

export function SynaroNewAgentCard({
  href = "/agents",
  className,
  variant = "default",
}: {
  href?: string;
  className?: string;
  variant?: "default" | "embedded";
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[11.25rem] cursor-pointer flex-col items-center justify-center rounded-xl px-5 py-8 text-sm font-medium text-muted-foreground transition sm:min-h-[12rem]",
        variant === "embedded"
          ? "border border-dashed border-border/40 bg-transparent hover:border-border/60 hover:bg-muted/25 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/35 dark:hover:bg-muted/15"
          : "border border-dashed border-border/70 hover:border-border hover:bg-muted/30 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 dark:border-border/55 dark:hover:bg-muted/15",
        className,
      )}
      data-onboarding="new-agent"
    >
      {t("agents.newAgent")}
    </Link>
  );
}

export function SynaroAgentsCardsGrid({
  agents = [],
  showNewAgent = true,
  newAgentHref = "/agents",
  cardVariant = "default",
  className,
  newAgentClassName,
}: {
  agents?: SynaroAgentCardModel[];
  showNewAgent?: boolean;
  newAgentHref?: string;
  cardVariant?: "default" | "embedded";
  className?: string;
  newAgentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:gap-5",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {agents.map((agent) => (
          <motion.div
            key={agent.id}
            layout
            className="min-w-0"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { type: "spring", stiffness: 420, damping: 28, mass: 0.85 },
            }}
            exit={{
              scale: [1, 1.04, 0],
              opacity: [1, 1, 0],
              transition: {
                duration: 0.32,
                times: [0, 0.2, 1],
                ease: "easeOut",
              },
            }}
          >
            <SynaroAgentCard agent={agent} variant={cardVariant} />
          </motion.div>
        ))}
      </AnimatePresence>
      {showNewAgent ? (
        <SynaroNewAgentCard href={newAgentHref} variant={cardVariant} className={newAgentClassName} />
      ) : null}
    </div>
  );
}
