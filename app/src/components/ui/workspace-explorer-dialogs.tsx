"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const dialogShellClass =
  "overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xl sm:max-w-md";

export function ExplorerNameDialog({
  open,
  title,
  description,
  label,
  defaultValue = "",
  confirmLabel = "Create",
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    void onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogShellClass}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="explorer-name-input">
              {label}
            </label>
            <Input
              id="explorer-name-input"
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className="h-10 rounded-xl border-border/70 bg-background font-mono text-sm"
              disabled={busy}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-lg"
              onClick={submit}
              disabled={busy || !value.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExplorerDeleteDialog({
  open,
  path,
  isFolder,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  path: string;
  isFolder: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogShellClass}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Delete {isFolder ? "folder" : "file"}?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This removes{" "}
              <span className={cn("font-mono text-foreground/90", isFolder && "break-all")}>
                {path}
              </span>{" "}
              from your workspace container. This cannot be undone.
            </DialogDescription>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-lg"
              onClick={() => void onConfirm()}
              disabled={busy}
            >
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
