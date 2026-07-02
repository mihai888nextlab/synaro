"use client";

import * as React from "react";
import {
  FileIcon,
  FilePlus2,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExplorerDeleteDialog,
  ExplorerNameDialog,
} from "@/components/ui/workspace-explorer-dialogs";
import { useTranslation } from "@/components/ui/locale-provider";
import { relativePathFromTreeItemId } from "@/lib/workspace-path-tree";
import {
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  renameWorkspaceEntry,
} from "@/lib/workspace-explorer-mutate";
import { cn } from "@/lib/utils";

export type ExplorerMenuTarget =
  | { kind: "background"; parentDir: string | null }
  | { kind: "file"; itemId: string; path: string }
  | { kind: "folder"; itemId: string; path: string };

type ExplorerContextMenuProps = {
  projectId?: string;
  canMutate: boolean;
  target: ExplorerMenuTarget | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
  onTreeMutated: () => void;
  onPathRemoved?: (path: string, isFolder: boolean) => void;
  onPathRenamed?: (from: string, to: string, isFolder: boolean) => void;
  /** Header toolbar shortcuts can open the same styled name dialog. */
  externalNameDialog?: {
    mode: "newFile" | "newFolder";
    parentDir: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null;
};

const menuContentClass =
  "min-w-[12rem] rounded-xl border-border/70 bg-card p-1.5 text-foreground shadow-lg";
const menuItemClass = "cursor-pointer gap-2 rounded-lg py-2 text-sm focus:bg-muted";

export function WorkspaceExplorerContextMenu({
  projectId,
  canMutate,
  target,
  position,
  onClose,
  onOpenFile,
  onTreeMutated,
  onPathRemoved,
  onPathRenamed,
  externalNameDialog,
}: ExplorerContextMenuProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const [nameDialog, setNameDialog] = React.useState<{
    mode: "newFile" | "newFolder" | "rename";
    defaultValue: string;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<{
    path: string;
    isFolder: boolean;
  } | null>(null);

  const parentDir =
    target?.kind === "background"
      ? target.parentDir
      : target?.kind === "folder"
        ? target.path
        : target?.kind === "file"
          ? target.path.includes("/")
            ? target.path.slice(0, target.path.lastIndexOf("/"))
            : null
          : null;

  const run = React.useCallback(
    async (fn: () => Promise<void>) => {
      if (!projectId || !canMutate || busy) return;
      setBusy(true);
      try {
        await fn();
        onTreeMutated();
        onClose();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : t("workspace.actionFailed"));
      } finally {
        setBusy(false);
      }
    },
    [projectId, canMutate, busy, onTreeMutated, onClose, t],
  );

  const activeNameDialog = React.useMemo(
    () =>
      nameDialog ??
      (externalNameDialog?.open
        ? {
            mode: externalNameDialog.mode,
            defaultValue:
              externalNameDialog.mode === "newFile" ? "untitled.txt" : "new-folder",
          }
        : null),
    [nameDialog, externalNameDialog],
  );

  const nameDialogOpen = Boolean(activeNameDialog);
  const nameDialogParentDir = externalNameDialog?.open
    ? externalNameDialog.parentDir
    : parentDir;

  const handleNameConfirm = React.useCallback(
    async (name: string) => {
      if (!projectId || !activeNameDialog) return;
      setBusy(true);
      try {
        if (activeNameDialog.mode === "newFile") {
          const path = await createWorkspaceFile(projectId, nameDialogParentDir, name);
          onTreeMutated();
          onOpenFile?.(path);
        } else if (activeNameDialog.mode === "newFolder") {
          await createWorkspaceFolder(projectId, nameDialogParentDir, name);
          onTreeMutated();
        } else if (target && target.kind !== "background") {
          const to = await renameWorkspaceEntry(projectId, target.path, name);
          onPathRenamed?.(target.path, to, target.kind === "folder");
          onTreeMutated();
        }
        setNameDialog(null);
        externalNameDialog?.onOpenChange(false);
        onClose();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : t("workspace.actionFailed"));
      } finally {
        setBusy(false);
      }
    },
    [
      projectId,
      activeNameDialog,
      nameDialogParentDir,
      onTreeMutated,
      onOpenFile,
      target,
      onPathRenamed,
      externalNameDialog,
      onClose,
    ],
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!projectId || !deleteDialog) return;
    await run(async () => {
      await deleteWorkspaceEntry(projectId, deleteDialog.path);
      onPathRemoved?.(deleteDialog.path, deleteDialog.isFolder);
      setDeleteDialog(null);
    });
  }, [projectId, deleteDialog, run, onPathRemoved]);

  const open = Boolean(target && position && canMutate && projectId);

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DropdownMenuTrigger asChild>
          <span
            className="pointer-events-none fixed z-50 h-px w-px"
            style={{
              left: position?.x ?? 0,
              top: position?.y ?? 0,
            }}
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={menuContentClass} align="start" sideOffset={4}>
          {target?.kind === "file" ? (
            <DropdownMenuItem
              className={menuItemClass}
              onSelect={() => {
                onOpenFile?.(target.path);
                onClose();
              }}
            >
              <FileIcon className="size-3.5 text-muted-foreground" />
              {t("workspace.openFile")}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            className={menuItemClass}
            disabled={busy}
            onSelect={() => setNameDialog({ mode: "newFile", defaultValue: "untitled.txt" })}
          >
            <FilePlus2 className="size-3.5 text-muted-foreground" />
            {t("workspace.newFileEllipsis")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={menuItemClass}
            disabled={busy}
            onSelect={() => setNameDialog({ mode: "newFolder", defaultValue: "new-folder" })}
          >
            <FolderPlus className="size-3.5 text-muted-foreground" />
            {t("workspace.newFolderEllipsis")}
          </DropdownMenuItem>

          {target && target.kind !== "background" ? (
            <>
              <DropdownMenuSeparator className="my-1 bg-border/60" />
              <DropdownMenuItem
                className={menuItemClass}
                disabled={busy}
                onSelect={() =>
                  setNameDialog({
                    mode: "rename",
                    defaultValue: target.path.split("/").pop() ?? target.path,
                  })
                }
              >
                <Pencil className="size-3.5 text-muted-foreground" />
                {t("workspace.renameEllipsis")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  menuItemClass,
                  "text-destructive focus:bg-destructive/10 focus:text-destructive",
                )}
                disabled={busy}
                onSelect={() =>
                  setDeleteDialog({
                    path: target.path,
                    isFolder: target.kind === "folder",
                  })
                }
              >
                <Trash2 className="size-3.5" />
                {t("common.delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ExplorerNameDialog
        open={nameDialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setNameDialog(null);
            externalNameDialog?.onOpenChange(false);
          }
        }}
        title={
          activeNameDialog?.mode === "rename"
            ? t("workspace.rename")
            : activeNameDialog?.mode === "newFolder"
              ? t("workspace.newFolder")
              : t("workspace.newFile")
        }
        description={
          activeNameDialog?.mode === "rename"
            ? t("workspace.renameDescription")
            : nameDialogParentDir
              ? t("workspace.insideFolder", { path: nameDialogParentDir })
              : t("workspace.atWorkspaceRoot")
        }
        label={
          activeNameDialog?.mode === "newFolder"
            ? t("workspace.folderName")
            : t("workspace.fileName")
        }
        defaultValue={activeNameDialog?.defaultValue ?? ""}
        confirmLabel={
          activeNameDialog?.mode === "rename"
            ? t("workspace.rename")
            : activeNameDialog?.mode === "newFolder"
              ? t("workspace.createFolder")
              : t("workspace.createFile")
        }
        busy={busy}
        onConfirm={handleNameConfirm}
      />

      <ExplorerDeleteDialog
        open={Boolean(deleteDialog)}
        path={deleteDialog?.path ?? ""}
        isFolder={deleteDialog?.isFolder ?? false}
        busy={busy}
        onOpenChange={(next) => {
          if (!next) setDeleteDialog(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

export function explorerTargetFromItemId(
  itemId: string,
  isFolder: boolean,
): ExplorerMenuTarget | null {
  const path = relativePathFromTreeItemId(itemId);
  if (!path) return null;
  return isFolder ? { kind: "folder", itemId, path } : { kind: "file", itemId, path };
}
