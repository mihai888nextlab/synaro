"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Github, Loader2, Upload, X } from "lucide-react";

import {
  SynaroProjectsCardsGrid,
  type SynaroProjectCardModel,
} from "@/components/ui/project-cards-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PROJECT_DOCKER_IMAGE_OPTIONS } from "@/lib/project-docker-images";
import { defaultProjectNameFromGithubUrl, normalizeGithubRepoUrl } from "@/lib/github-repo-url";
import { cn } from "@/lib/utils";

type GithubRepoRow = {
  id: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  private: boolean;
  updatedAt: string | null;
};

type TabKey = "create" | "import";
type GithubImportSource = "url" | "repos";

export function ProjectsPageClient({ initialProjects }: { initialProjects: SynaroProjectCardModel[] }) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<SynaroProjectCardModel[]>(initialProjects);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("create");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dockerImage, setDockerImage] = React.useState<string>(PROJECT_DOCKER_IMAGE_OPTIONS[0].value);

  const [importFiles, setImportFiles] = React.useState<File[]>([]);
  const [githubUrl, setGithubUrl] = React.useState("");
  const [githubImportSource, setGithubImportSource] = React.useState<GithubImportSource>("url");
  const [githubRepos, setGithubRepos] = React.useState<GithubRepoRow[]>([]);
  const [githubReposLoading, setGithubReposLoading] = React.useState(false);
  const [githubReposError, setGithubReposError] = React.useState<string | null>(null);
  const [githubReposHint, setGithubReposHint] = React.useState<string | null>(null);
  const [githubReposPage, setGithubReposPage] = React.useState(1);
  const [githubReposHasMore, setGithubReposHasMore] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [importProjectName, setImportProjectName] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  /** Shown after a successful create when the Docker / environment-service step did not complete. */
  const [postCreateNotice, setPostCreateNotice] = React.useState<string | null>(null);
  const [dockerBusyId, setDockerBusyId] = React.useState<string | null>(null);

  const folderInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  /** Refresh Docker/runtime pills from environment-service (falls back to DB if unreachable). */
  React.useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { projects?: SynaroProjectCardModel[] };
        if (body.projects && !cancelled) setProjects(body.projects);
      } catch {
        /* ignore */
      }
    }
    void refresh();
    const id = window.setInterval(refresh, 18000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  function resetForms() {
    setTitle("");
    setDescription("");
    setDockerImage(PROJECT_DOCKER_IMAGE_OPTIONS[0].value);
    setImportFiles([]);
    setGithubUrl("");
    setGithubImportSource("url");
    setGithubRepos([]);
    setGithubReposError(null);
    setGithubReposHint(null);
    setGithubReposPage(1);
    setGithubReposHasMore(false);
    setImportProjectName("");
    setTab("create");
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForms();
  }

  async function submitProjectToApi(payload: {
    name: string;
    description?: string;
    dockerImage: string;
    repositoryUrl?: string;
  }) {
    setSubmitting(true);
    setSubmitError(null);
    setPostCreateNotice(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data: {
        error?: string;
        detail?: string;
        hint?: string;
        project?: SynaroProjectCardModel;
        environmentWarning?: string;
      } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setSubmitError(`Unexpected response (${res.status}). Try again.`);
          return;
        }
      }

      if (!res.ok) {
        const parts = [data.error, data.detail, data.hint].filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        );
        setSubmitError(parts.join(" — ") || `Request failed (${res.status})`);
        return;
      }

      if (!data.project) {
        setSubmitError("Unexpected response from server.");
        return;
      }

      setProjects((prev) => {
        const rest = prev.filter((p) => p.id !== data.project!.id);
        return [data.project!, ...rest];
      });

      if (data.environmentWarning) {
        setPostCreateNotice(data.environmentWarning);
        handleOpenChange(false);
        return;
      }

      handleOpenChange(false);
      await router.push(`/projects/${encodeURIComponent(data.project.slug)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(
        /failed to fetch|fetch failed|networkerror/i.test(msg)
          ? "Could not reach the app (network error). Check that Next.js is running and try again."
          : msg || "Something went wrong — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitProjectToApi({
      name: title,
      description: description.trim() || undefined,
      dockerImage,
    });
  }

  async function handleImportContinue() {
    const trimmed = githubUrl.trim();
    if (trimmed) {
      const normalized = normalizeGithubRepoUrl(trimmed);
      if (!normalized) {
        setSubmitError("Enter a valid GitHub repository URL (https://github.com/owner/repo).");
        return;
      }
      const name = importProjectName.trim() || defaultProjectNameFromGithubUrl(normalized);
      await submitProjectToApi({
        name,
        description: description.trim() || undefined,
        dockerImage,
        repositoryUrl: trimmed,
      });
      return;
    }
    if (importFiles.length > 0) {
      handleOpenChange(false);
    }
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setImportFiles(Array.from(list));
    e.target.value = "";
  }

  const fetchGithubRepos = React.useCallback(async (page: number, append: boolean) => {
    setGithubReposLoading(true);
    setGithubReposError(null);
    setGithubReposHint(null);
    try {
      const res = await fetch(`/api/github/user-repos?page=${page}`);
      const data = (await res.json().catch(() => null)) as {
        repos?: GithubRepoRow[];
        hasMore?: boolean;
        error?: string;
        hint?: string;
        code?: string;
      } | null;
      if (!res.ok) {
        setGithubReposError(data?.error ?? `Request failed (${res.status})`);
        setGithubReposHint(typeof data?.hint === "string" ? data.hint : null);
        if (!append) setGithubRepos([]);
        return;
      }
      const next = data?.repos ?? [];
      setGithubRepos((prev) => (append ? [...prev, ...next] : next));
      setGithubReposHasMore(Boolean(data?.hasMore));
      setGithubReposPage(page);
    } catch {
      setGithubReposError("Could not load repositories.");
      if (!append) setGithubRepos([]);
    } finally {
      setGithubReposLoading(false);
    }
  }, []);

  function handleSelectGithubRepo(repo: GithubRepoRow) {
    setGithubUrl(repo.htmlUrl);
    setGithubImportSource("url");
    const n = normalizeGithubRepoUrl(repo.htmlUrl);
    if (n) setImportProjectName(defaultProjectNameFromGithubUrl(n));
  }

  function onDrop(e: React.DragEvent) {
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) setImportFiles(files);
  }

  const handleDockerClick = React.useCallback(async (projectId: string, action: "start" | "stop") => {
    setDockerBusyId(projectId);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/docker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const raw = await res.text();
      let data: { error?: string; project?: SynaroProjectCardModel } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setSubmitError("Invalid response from server.");
          return;
        }
      }
      if (!res.ok) {
        setSubmitError(data.error ?? `Docker action failed (${res.status})`);
        return;
      }
      if (data.project) {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? data.project! : p)));
      }
    } catch {
      setSubmitError("Could not reach the app to update Docker.");
    } finally {
      setDockerBusyId(null);
    }
  }, []);

  return (
    <div className="relative w-full flex-1">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="sr-only">Projects</h1>

        {postCreateNotice ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-500/25 dark:bg-amber-950/40"
          >
            <span className="font-medium">Project created.</span> {postCreateNotice}
          </p>
        ) : null}

        {submitError && !open ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </p>
        ) : null}

        <SynaroProjectsCardsGrid
          projects={projects}
          showNewProject
          newProjectHref="/projects"
          dockerInteractive
          dockerBusyId={dockerBusyId}
          onDockerClick={handleDockerClick}
          onNewProjectClick={() => {
            setTab("create");
            setSubmitError(null);
            setPostCreateNotice(null);
            handleOpenChange(true);
          }}
        />

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            className={cn(
              "max-h-[min(90vh,720px)] w-[min(100%,36rem)] max-w-none overflow-y-auto rounded-2xl border-2 border-border bg-card p-0 shadow-2xl",
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
                {submitError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="project-title"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    Project name
                  </label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Customer portal"
                    required
                    autoComplete="off"
                    disabled={submitting}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="project-description"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this project do?"
                    rows={4}
                    disabled={submitting}
                    className={cn(
                      "min-h-[96px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm shadow-black/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="docker-image"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    Runtime image
                  </label>
                  <select
                    id="docker-image"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                    disabled={submitting}
                    className={cn(
                      "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm shadow-black/5",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    )}
                  >
                    {PROJECT_DOCKER_IMAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-border/70"
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-full" disabled={submitting}>
                    {submitting ? "Creating…" : "Create project"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
                {submitError && tab === "import" ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}
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

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    GitHub
                  </p>
                  <div
                    role="tablist"
                    aria-label="GitHub import source"
                    className="flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={githubImportSource === "url"}
                      onClick={() => setGithubImportSource("url")}
                      className={cn(
                        "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:text-sm",
                        githubImportSource === "url"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Repo link
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={githubImportSource === "repos"}
                      onClick={() => {
                        setGithubImportSource("repos");
                        void fetchGithubRepos(1, false);
                      }}
                      className={cn(
                        "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:text-sm",
                        githubImportSource === "repos"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      My repositories
                    </button>
                  </div>

                  {githubImportSource === "url" ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        onBlur={() => {
                          const n = normalizeGithubRepoUrl(githubUrl);
                          if (!n) return;
                          setImportProjectName((prev) =>
                            prev.trim() === "" ? defaultProjectNameFromGithubUrl(n) : prev,
                          );
                        }}
                        placeholder="https://github.com/org/repo"
                        type="url"
                        inputMode="url"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste a repository URL. To pick from repos you own or collaborate on, use{" "}
                        <span className="font-medium text-foreground">My repositories</span> (requires{" "}
                        <Link
                          href="/settings/profile"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          GitHub connected
                        </Link>
                        ).
                      </p>
                    </div>
                  ) : (
                    <div className="flex min-h-[10rem] flex-col gap-2">
                      {githubReposLoading && githubRepos.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                          Loading your repositories…
                        </div>
                      ) : null}
                      {githubReposError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          <p>{githubReposError}</p>
                          {githubReposHint ? (
                            <p className="mt-1 text-xs text-muted-foreground">{githubReposHint}</p>
                          ) : null}
                          <p className="mt-2 text-xs">
                            <Link
                              href="/settings/profile"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Open profile settings
                            </Link>
                          </p>
                        </div>
                      ) : null}
                      {!githubReposLoading && !githubReposError && githubRepos.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No repositories in this page. Try{" "}
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => void fetchGithubRepos(1, false)}
                          >
                            refresh
                          </button>
                          .
                        </p>
                      ) : null}
                      {githubRepos.length > 0 ? (
                        <ul className="max-h-[min(40vh,17rem)] space-y-0.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-1">
                          {githubRepos.map((repo) => (
                            <li key={`${repo.id}-${repo.fullName}`}>
                              <button
                                type="button"
                                onClick={() => handleSelectGithubRepo(repo)}
                                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted"
                              >
                                <Github className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium text-foreground">{repo.fullName}</span>
                                  {repo.private ? (
                                    <span className="ms-2 align-middle rounded-md border border-border/80 px-1 py-px text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                                      Private
                                    </span>
                                  ) : null}
                                  {repo.description ? (
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                      {repo.description}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {githubRepos.length > 0 && githubReposHasMore ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg border-border/70"
                          disabled={githubReposLoading}
                          onClick={() => void fetchGithubRepos(githubReposPage + 1, true)}
                        >
                          {githubReposLoading ? (
                            <>
                              <Loader2 className="me-2 size-4 shrink-0 animate-spin" aria-hidden />
                              Loading…
                            </>
                          ) : (
                            "Load more"
                          )}
                        </Button>
                      ) : null}
                      {githubRepos.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Click a row to copy its URL into the repo link field.
                        </p>
                      ) : null}
                    </div>
                  )}

                  {githubUrl.trim() ? (
                    <p className="truncate rounded-lg border border-border/50 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/80">Selected </span>
                      <span className="font-mono text-foreground" title={githubUrl.trim()}>
                        {githubUrl.trim()}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="import-project-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    Project name
                  </label>
                  <Input
                    id="import-project-name"
                    value={importProjectName}
                    onChange={(e) => setImportProjectName(e.target.value)}
                    placeholder="Defaults to GitHub repo name (e.g. my-app)"
                    disabled={submitting}
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="import-docker-image"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    Runtime image
                  </label>
                  <select
                    id="import-docker-image"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                    disabled={submitting}
                    className={cn(
                      "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm shadow-black/5",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    )}
                  >
                    {PROJECT_DOCKER_IMAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    The container installs Git, clones your repo into <span className="font-mono">/tmp/synaro-workspace/app</span>
                    , then keeps running for your workspace.
                  </p>
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
                    disabled={submitting || (importFiles.length === 0 && !githubUrl.trim())}
                    onClick={() => void handleImportContinue()}
                  >
                    {submitting && githubUrl.trim()
                      ? "Importing…"
                      : submitting
                        ? "Working…"
                        : githubUrl.trim()
                          ? "Import project"
                          : "Continue"}
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
