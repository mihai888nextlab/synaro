"use client";

import * as React from "react";
import { Github, Upload, X } from "lucide-react";

import { SynaroProjectsCardsGrid } from "@/components/ui/project-cards-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TabKey = "create" | "import";

const DOCKER_IMAGE_OPTIONS = [
  { value: "automatic", label: "Automatic (recommended)" },
  { value: "node:22-bookworm-slim", label: "Node.js 22 (Debian slim)" },
  { value: "python:3.12-slim", label: "Python 3.12 (slim)" },
  { value: "golang:1.23-bookworm", label: "Go 1.23 (Debian)" },
  { value: "nginx:1.27-alpine", label: "Nginx (Alpine)" },
  { value: "ubuntu:24.04", label: "Ubuntu 24.04 (generic)" },
] as const;

export function ProjectsPageClient() {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("create");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dockerImage, setDockerImage] = React.useState<string>(DOCKER_IMAGE_OPTIONS[0].value);

  const [importFiles, setImportFiles] = React.useState<File[]>([]);
  const [githubUrl, setGithubUrl] = React.useState("");
  const [dragActive, setDragActive] = React.useState(false);

  const folderInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  function resetForms() {
    setTitle("");
    setDescription("");
    setDockerImage(DOCKER_IMAGE_OPTIONS[0].value);
    setImportFiles([]);
    setGithubUrl("");
    setTab("create");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForms();
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleOpenChange(false);
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setImportFiles(Array.from(list));
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) setImportFiles(files);
  }

  return (
    <div className="relative w-full flex-1">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="sr-only">Projects</h1>

        <SynaroProjectsCardsGrid
          showNewProject
          newProjectHref="/projects"
          onNewProjectClick={() => {
            setTab("create");
            handleOpenChange(true);
          }}
        />

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            className={cn(
              "max-h-[min(90vh,720px)] w-[min(100%,28rem)] max-w-none overflow-y-auto rounded-2xl border-border/70 bg-card p-0 shadow-[0_24px_80px_rgba(0,0,0,0.22)]",
            )}
          >
            <div className="flex flex-col gap-0 border-b border-border/70 px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                    New project
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                    Create a workspace or import existing code.
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              </div>

              <div
                role="tablist"
                aria-label="Project setup"
                className="mt-4 flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "create"}
                  onClick={() => setTab("create")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                    tab === "create"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Create
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "import"}
                  onClick={() => setTab("import")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                    tab === "import"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Import
                </button>
              </div>
            </div>

            {tab === "create" ? (
              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="project-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Project name
                  </label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Customer portal"
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="project-description" className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this project do?"
                    rows={4}
                    className={cn(
                      "min-h-[96px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="docker-image" className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Runtime image
                  </label>
                  <select
                    id="docker-image"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                    className={cn(
                      "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm shadow-black/5",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    )}
                  >
                    {DOCKER_IMAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-full border-border/70">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-full">
                    Create project
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
                <input
                  ref={folderInputRef}
                  type="file"
                  className="sr-only"
                  multiple
                  onChange={handleFolderInputChange}
                />

                <button
                  type="button"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget === e.target) setDragActive(false);
                  }}
                  onDrop={onDrop}
                  onClick={() => folderInputRef.current?.click()}
                  className={cn(
                    "flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition",
                    dragActive
                      ? "border-foreground/30 bg-muted/50"
                      : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/35",
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground">
                    <Upload className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Drop a folder here</p>
                    <p className="text-xs text-muted-foreground">
                      Or click to choose a folder from Finder. Nested files are included when your browser allows it.
                    </p>
                  </div>
                </button>

                {importFiles.length > 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {importFiles.length} file{importFiles.length === 1 ? "" : "s"} selected
                  </p>
                ) : null}

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">GitHub</p>
                  <Input
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    type="url"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 rounded-full border-border/70 sm:w-auto sm:self-start"
                    disabled={!githubUrl.trim()}
                    onClick={() => handleOpenChange(false)}
                  >
                    <Github className="size-4 shrink-0" />
                    Import from GitHub
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-full border-border/70">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={importFiles.length === 0 && !githubUrl.trim()}
                    onClick={() => handleOpenChange(false)}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
