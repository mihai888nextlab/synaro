"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notifications = [
  {
    title: "Deployment finished",
    description: "Production rollout completed successfully.",
    time: "2m ago",
  },
  {
    title: "New project created",
    description: "Core Platform was added to your workspace.",
    time: "1h ago",
  },
  {
    title: "Policy check passed",
    description: "All rules validated for staging environment.",
    time: "Yesterday",
  },
];

export function DashboardNotifications() {
  const unreadCount = 3;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-xl border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 hover:bg-muted hover:text-foreground"
          aria-label="Open notifications"
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
        <div className="max-h-[360px] overflow-auto py-1">
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.title}
              className="items-start rounded-lg px-2 py-2 focus:bg-accent"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{n.time}</span>
                </div>
                <span className="text-xs text-muted-foreground">{n.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

