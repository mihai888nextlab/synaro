"use client";

import { Bell, Bot, CheckCircle2, Info, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/ui/locale-provider";
import {
  canUseBrowserNotifications,
  requestBrowserNotificationPermission,
  useNotifications,
  type AppNotification,
  type AppNotificationType,
} from "@/components/ui/notifications";
import { formatNotificationDescription } from "@/lib/notifications/format-notification-body";
import { cn } from "@/lib/utils";

function timeAgo(
  ms: number,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return t("notifications.timeAgoSeconds", { count: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t("notifications.timeAgoMinutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.timeAgoHours", { count: h });
  const d = Math.floor(h / 24);
  return t("notifications.timeAgoDays", { count: d });
}

function isFailureType(type: AppNotificationType) {
  return type === "agent_run_failed" || type === "ai_task_failed";
}

function isSuccessType(type: AppNotificationType) {
  return type === "agent_run_done" || type === "ai_task_done";
}

function typeMeta(
  type: AppNotificationType,
  t: (key: string) => string,
): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
} {
  switch (type) {
    case "agent_run_failed":
      return {
        icon: XCircle,
        label: t("notifications.badgeFailed"),
        tone: "bg-red-500/10 text-red-600 dark:text-red-400",
      };
    case "ai_task_failed":
      return {
        icon: XCircle,
        label: t("notifications.badgeFailed"),
        tone: "bg-red-500/10 text-red-600 dark:text-red-400",
      };
    case "agent_run_done":
      return {
        icon: Bot,
        label: t("notifications.badgeAgent"),
        tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "ai_task_done":
      return {
        icon: Sparkles,
        label: t("notifications.badgeAi"),
        tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    default:
      return {
        icon: Info,
        label: t("notifications.badgeInfo"),
        tone: "bg-muted text-muted-foreground",
      };
  }
}

function NotificationRow({
  n,
  t,
}: {
  n: AppNotification;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const failed = isFailureType(n.type);
  const success = isSuccessType(n.type);
  const meta = typeMeta(n.type, t);
  const Icon = meta.icon;
  const description = formatNotificationDescription(n.description, {
    failed,
    t: (key) => t(`notifications.${key}`),
  });

  const body = (
    <div className="flex w-full items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          failed && "bg-red-500/10 text-red-600 dark:text-red-400",
          success && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          !failed && !success && "bg-muted text-muted-foreground",
        )}
      >
        {success && n.type.startsWith("ai_") ? (
          <CheckCircle2 className="size-4" aria-hidden />
        ) : (
          <Icon className="size-4" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium leading-snug text-foreground">{n.title}</p>
          <span className="shrink-0 pt-0.5 text-[0.65rem] tabular-nums text-muted-foreground">
            {timeAgo(n.createdAtMs, t)}
          </span>
        </div>
        {description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex items-center gap-2 pt-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium",
              meta.tone,
            )}
          >
            {meta.label}
          </span>
          {n.unread ? (
            <span className="size-1.5 rounded-full bg-primary" aria-label={t("notifications.unread")} />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer items-start rounded-xl px-2.5 py-2.5 focus:bg-accent",
        n.unread && "bg-muted/30",
      )}
      asChild={Boolean(n.href)}
    >
      {n.href ? (
        <Link href={n.href} className="w-full outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
    </DropdownMenuItem>
  );
}

export function DashboardNotifications() {
  const { t } = useTranslation();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) markAllRead();
  }, [open, markAllRead]);

  const browserPermission =
    typeof window !== "undefined" && canUseBrowserNotifications()
      ? Notification.permission
      : "denied";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-xl border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 hover:bg-muted hover:text-foreground"
          aria-label={t("notifications.openAria")}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[360px] rounded-xl border-border/70 bg-popover p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        side="bottom"
        sideOffset={8}
        align="end"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("notifications.title")}
          </span>
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={() => clearAll()}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t("notifications.clear")}
            </button>
          ) : null}
        </div>

        {browserPermission !== "granted" ? (
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={() => void requestBrowserNotificationPermission()}
              className="w-full rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t("notifications.enableBrowser")}
            </button>
          </div>
        ) : null}

        <div className="max-h-[400px] overflow-auto py-1">
          {notifications.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            notifications.map((n) => <NotificationRow key={n.id} n={n} t={t} />)
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
