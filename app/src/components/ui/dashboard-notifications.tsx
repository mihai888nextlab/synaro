"use client";

import { Bell } from "lucide-react";
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
} from "@/components/ui/notifications";

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
        className="w-[320px] rounded-xl border-border/70 bg-popover p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        side="bottom"
        sideOffset={8}
        align="end"
      >
        <div className="flex items-center justify-between gap-2 px-1 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("notifications.title")}
          </span>
          <button
            type="button"
            onClick={() => clearAll()}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t("notifications.clear")}
          </button>
        </div>

        {browserPermission !== "granted" ? (
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={() => void requestBrowserNotificationPermission()}
              className="w-full rounded-lg border border-border/60 bg-muted/40 px-2 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t("notifications.enableBrowser")}
            </button>
          </div>
        ) : null}

        <div className="max-h-[360px] overflow-auto py-1">
          {notifications.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start rounded-lg px-2 py-2 focus:bg-accent"
                asChild={Boolean(n.href)}
              >
                {n.href ? (
                  <Link href={n.href} className="flex w-full items-start">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(n.createdAtMs, t)}
                        </span>
                      </div>
                      {n.description ? (
                        <span className="text-xs text-muted-foreground">{n.description}</span>
                      ) : null}
                    </div>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(n.createdAtMs, t)}
                      </span>
                    </div>
                    {n.description ? (
                      <span className="text-xs text-muted-foreground">{n.description}</span>
                    ) : null}
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
