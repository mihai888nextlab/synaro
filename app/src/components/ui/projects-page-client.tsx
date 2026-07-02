"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getProviders, signIn } from "next-auth/react";
import { ChevronDown, Github, Loader2, Upload, X } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PROJECT_DOCKER_IMAGE_OPTIONS } from "@/lib/project-docker-images";
import { defaultProjectNameFromGithubUrl, normalizeGithubRepoUrl } from "@/lib/github-repo-url";
import { defaultFolderImportName } from "@/lib/import-folder-paths";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/ui/locale-provider";
import { invalidateSearchIndex, prefetchSearchIndex } from "@/hooks/use-search-index";

type GithubRepoRow = {
  id: number;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  private: boolean;
  updatedAt: string | null;
};

type TabKey = "create" | "import";

type LocalImportEntry = { file: File; relativePath: string };

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const acc: FileSystemEntry[] = [];
    const read = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(acc);
        else {
          acc.push(...batch);
          read();
        }
      }, reject);
    };
    read();
  });
}

async function walkDirectoryEntry(
  dir: FileSystemDirectoryEntry,
  prefix: string,
  out: LocalImportEntry[],
): Promise<void> {
  const reader = dir.createReader();
  const entries = await readAllDirectoryEntries(reader);
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isFile) {
      await new Promise<void>((resolve) => {
        (e as FileSystemFileEntry).file(
          (f) => {
            out.push({ file: f, relativePath: rel });
            resolve();
          },
          () => resolve(),
        );
      });
    } else if (e.isDirectory) {
      await walkDirectoryEntry(e as FileSystemDirectoryEntry, rel, out);
    }
  }
}

async function collectLocalImportEntries(dt: DataTransfer): Promise<LocalImportEntry[]> {
  const items = dt.items;
  if (!items || items.length === 0) {
    return Array.from(dt.files ?? []).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
  }
  const out: LocalImportEntry[] = [];
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;
    const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
    if (entry?.isDirectory) {
      const dir = entry as FileSystemDirectoryEntry;
      tasks.push(walkDirectoryEntry(dir, dir.name, out));
    } else if (entry?.isFile) {
      tasks.push(
        new Promise((resolve) => {
          (entry as FileSystemFileEntry).file(
            (f) => {
              out.push({ file: f, relativePath: f.name });
              resolve();
            },
            () => resolve(),
          );
        }),
      );
    } else {
      const f = item.getAsFile();
      if (f) {
        out.push({
          file: f,
          relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        });
      }
    }
  }
  await Promise.all(tasks);
  const byPath = new Map<string, LocalImportEntry>();
  for (const e of out) {
    const k = e.relativePath.replace(/\\/g, "/");
    byPath.set(k, { file: e.file, relativePath: k });
  }
  return [...byPath.values()];
}

export function ProjectsPageClient({
  initialProjects,
  linkedGithub,
}: {
  initialProjects: SynaroProjectCardModel[];
  linkedGithub: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [projects, setProjects] = React.useState<SynaroProjectCardModel[]>(initialProjects);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("create");

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dockerImage, setDockerImage] = React.useState<string>(PROJECT_DOCKER_IMAGE_OPTIONS[0].value);

  const [importEntries, setImportEntries] = React.useState<LocalImportEntry[]>([]);
  const [githubUrl, setGithubUrl] = React.useState("");
  const [githubRepos, setGithubRepos] = React.useState<GithubRepoRow[]>([]);
  const [githubReposLoading, setGithubReposLoading] = React.useState(false);
  const [githubReposError, setGithubReposError] = React.useState<string | null>(null);
  const [githubReposHint, setGithubReposHint] = React.useState<string | null>(null);
  const [githubReposPage, setGithubReposPage] = React.useState(1);
  const [githubReposHasMore, setGithubReposHasMore] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  /** GitHub repo list opens in a dropdown from “My repositories”. */
  const [githubReposMenuOpen, setGithubReposMenuOpen] = React.useState(false);
  const [githubConnectBusy, setGithubConnectBusy] = React.useState(false);
  const [githubConnectMessage, setGithubConnectMessage] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  /** Shown after a successful create when the Docker / environment-service step did not complete. */
  const [postCreateNotice, setPostCreateNotice] = React.useState<string | null>(null);

  const dockerImageOptions = React.useMemo(
    () =>
      PROJECT_DOCKER_IMAGE_OPTIONS.map((opt) => {
        const labelByValue: Record<string, string> = {
          automatic: t("projects.runtimeAutomatic"),
          "node:22-bookworm-slim": t("projects.runtimeNode22"),
          "python:3.12-slim": t("projects.runtimePython312"),
          "golang:1.23-bookworm": t("projects.runtimeGo123"),
          "nginx:1.27-alpine": t("projects.runtimeNginx"),
          "ubuntu:24.04": t("projects.runtimeUbuntu"),
        };
        return { value: opt.value, label: labelByValue[opt.value] ?? opt.label };
      }),
    [t],
  );
  const [dockerBusyId, setDockerBusyId] = React.useState<string | null>(null);

  const folderInputRef = React.useRef<HTMLInputElement>(null);
  /** Mirrors latest `projects` for optimistic delete revert without stale closures. */
  const projectsRef = React.useRef(initialProjects);
  /** DELETE in flight — hide these from periodic refresh until the request finishes (avoids “card comes back”). */
  const deleteInFlightRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

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
        if (body.projects && !cancelled) {
          const hidden = deleteInFlightRef.current;
          setProjects(
            hidden.size === 0
              ? body.projects
              : body.projects.filter((p) => !hidden.has(p.id)),
          );
        }
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

  const handleProjectDelete = React.useCallback(async (projectId: string) => {
    setDeleteError(null);
    const snapshot = [...projectsRef.current];
    deleteInFlightRef.current.add(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
      deleteInFlightRef.current.delete(projectId);
      if (res.status === 204 || res.status === 404) {
        invalidateSearchIndex();
        void prefetchSearchIndex();
        return;
      }
      setProjects(snapshot);
      const raw = await res.text();
      let message = `Could not delete project (${res.status}).`;
      if (raw) {
        try {
          const body = JSON.parse(raw) as { error?: string; detail?: string };
          const parts = [body.error, body.detail].filter(
            (s): s is string => typeof s === "string" && s.length > 0,
          );
          if (parts.length > 0) message = parts.join(" — ");
        } catch {
          /* keep default message */
        }
      }
      setDeleteError(message);
    } catch (err) {
      deleteInFlightRef.current.delete(projectId);
      setProjects(snapshot);
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(
        /failed to fetch|fetch failed|networkerror/i.test(msg)
          ? "Could not reach the app while deleting. Check your connection and try again."
          : msg || "Delete failed.",
      );
    }
  }, []);

  function resetForms() {
    setTitle("");
    setDescription("");
    setDockerImage(PROJECT_DOCKER_IMAGE_OPTIONS[0].value);
    setImportEntries([]);
    setGithubUrl("");
    setGithubRepos([]);
    setGithubReposError(null);
    setGithubReposHint(null);
    setGithubReposPage(1);
    setGithubReposHasMore(false);
    setGithubReposMenuOpen(false);
    setGithubConnectMessage(null);
    setGithubConnectBusy(false);
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
      invalidateSearchIndex();
      void prefetchSearchIndex();

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

  async function submitFolderImportToApi() {
    const paths = importEntries.map((e) => e.relativePath);
    const name = defaultFolderImportName(paths.length > 0 ? paths : ["imported-project"]);
    const trimmedDesc = description.trim();

    setSubmitting(true);
    setSubmitError(null);
    setPostCreateNotice(null);
    try {
      const fd = new FormData();
      fd.append("name", name);
      if (trimmedDesc) fd.append("description", trimmedDesc);
      fd.append("dockerImage", dockerImage);
      for (const { file, relativePath } of importEntries) {
        fd.append("files", file, relativePath.replace(/\\/g, "/"));
      }

      const res = await fetch("/api/projects/import-folder", {
        method: "POST",
        body: fd,
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
      invalidateSearchIndex();
      void prefetchSearchIndex();

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
        setSubmitError(t("projects.invalidGithubUrl"));
        return;
      }
      const name = defaultProjectNameFromGithubUrl(normalized);
      await submitProjectToApi({
        name,
        description: description.trim() || undefined,
        dockerImage,
        repositoryUrl: trimmed,
      });
      return;
    }
    if (importEntries.length > 0) {
      await submitFolderImportToApi();
      return;
    }
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setImportEntries(
      Array.from(list).map((file) => ({
        file,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      })),
    );
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

  async function handleConnectGithubFromProjects() {
    setGithubConnectMessage(null);
    setGithubConnectBusy(true);
    try {
      const providers = await getProviders();
      if (!providers?.github) {
        setGithubConnectMessage(
          "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the server.",
        );
        return;
      }
      await signIn("github", { callbackUrl: "/projects" });
    } catch {
      setGithubConnectMessage("Could not start GitHub sign-in.");
    } finally {
      setGithubConnectBusy(false);
    }
  }

  React.useEffect(() => {
    if (tab !== "import") setGithubReposMenuOpen(false);
  }, [tab]);

  function handleSelectGithubRepo(repo: GithubRepoRow) {
    setGithubUrl(repo.htmlUrl);
    setGithubReposMenuOpen(false);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    try {
      const entries = await collectLocalImportEntries(e.dataTransfer);
      if (entries.length) setImportEntries(entries);
    } catch {
      setSubmitError("Could not read the dropped folder. Try choosing it with the file picker instead.");
    }
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
        <h1 className="sr-only">{t("projects.title")}</h1>

        {postCreateNotice ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-500/25 dark:bg-amber-950/40"
          >
            <span className="font-medium">{t("projects.projectCreated")}</span> {postCreateNotice}
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

        {deleteError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {deleteError}
          </p>
        ) : null}

        <SynaroProjectsCardsGrid
          projects={projects}
          showNewProject
          newProjectHref="/projects"
          dockerInteractive
          dockerBusyId={dockerBusyId}
          onDockerClick={handleDockerClick}
          cardMoreMenu
          onProjectDelete={handleProjectDelete}
          onNewProjectClick={() => {
            setTab("create");
            setSubmitError(null);
            setDeleteError(null);
            setPostCreateNotice(null);
            handleOpenChange(true);
          }}
        />

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            data-onboarding="new-project-dialog"
            className={cn(
              "max-h-[min(90vh,720px)] w-[min(calc(100vw-1.5rem),36rem)] max-w-none overflow-y-auto rounded-2xl border-2 border-border bg-card p-0 shadow-2xl sm:w-[min(100%,36rem)]",
            )}
          >
            <div className="flex flex-col gap-0 border-b border-border/70 px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                    {t("projects.newProjectDialogTitle")}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                    {t("projects.newProjectDialogDescription")}
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-xl border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={t("projects.close")}
                  >
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              </div>

              <div
                role="tablist"
                aria-label={t("projects.tabListAriaLabel")}
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
                  {t("projects.tabCreate")}
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
                  {t("projects.tabImport")}
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
                    {t("projects.projectName")}
                  </label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("projects.projectNamePlaceholder")}
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
                    {t("projects.description")}
                  </label>
                  <textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("projects.descriptionPlaceholder")}
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
                    {t("projects.runtimeImage")}
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
                    {dockerImageOptions.map((opt) => (
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
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-full" disabled={submitting}>
                    {submitting ? t("projects.creating") : t("projects.createProject")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-5 px-4 py-4 sm:px-5 sm:py-5">
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
                  {...({ webkitdirectory: "", mozdirectory: "" } as Record<string, string>)}
                  onChange={handleFolderInputChange}
                />

                <section className="flex flex-col gap-2">
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
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-medium text-foreground">{t("projects.dropFolder")}</p>
                    </div>
                  </button>
                  {importEntries.length > 0 ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {importEntries.length === 1
                        ? t("projects.filesReadyOne", { count: importEntries.length })
                        : t("projects.filesReadyMany", { count: importEntries.length })}
                    </p>
                  ) : null}
                </section>

                <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
                  <h3 className="text-sm font-semibold text-foreground">{t("projects.github")}</h3>

                  {!linkedGithub ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl border-border/70 sm:w-[min(100%,20rem)]"
                        disabled={submitting || githubConnectBusy}
                        onClick={() => void handleConnectGithubFromProjects()}
                      >
                        {githubConnectBusy ? t("auth.redirecting") : t("projects.connectGitHub")}
                      </Button>
                      {githubConnectMessage ? (
                        <p role="alert" className="text-sm text-destructive">
                          {githubConnectMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <DropdownMenu
                      modal={false}
                      open={githubReposMenuOpen}
                      onOpenChange={(next) => {
                        setGithubReposMenuOpen(next);
                        if (next) void fetchGithubRepos(1, false);
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between rounded-xl border-border/70 sm:w-[min(100%,20rem)]"
                          disabled={submitting}
                          aria-expanded={githubReposMenuOpen}
                        >
                          <span>{t("projects.myRepositories")}</span>
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              githubReposMenuOpen && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        sideOffset={6}
                        className="z-[10000] w-[min(22rem,calc(100vw-2rem))] rounded-xl border-border/70 p-0"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        onWheel={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div
                          className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-y-contain p-1 touch-pan-y"
                          onWheel={(e) => {
                            e.stopPropagation();
                          }}
                        >
                        {githubReposLoading && githubRepos.length === 0 ? (
                          <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                            {t("common.loading")}
                          </div>
                        ) : null}
                        {githubReposError ? (
                          <>
                            <div className="space-y-2 px-3 py-3 text-sm text-destructive">
                              <p>{githubReposError}</p>
                              {githubReposHint ? (
                                <p className="text-xs text-muted-foreground">{githubReposHint}</p>
                              ) : null}
                              <Link
                                href="/settings/profile"
                                className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {t("projects.openProfileSettings")}
                              </Link>
                            </div>
                            <DropdownMenuItem
                              className="cursor-pointer justify-center text-center text-primary"
                              onSelect={(e) => {
                                e.preventDefault();
                                void fetchGithubRepos(1, false);
                              }}
                            >
                              {t("projects.tryAgain")}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {!githubReposLoading && !githubReposError && githubRepos.length === 0 ? (
                          <>
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                              {t("projects.noRepositoriesOnPage")}
                            </div>
                            <DropdownMenuItem
                              className="cursor-pointer justify-center text-center text-primary"
                              onSelect={(e) => {
                                e.preventDefault();
                                void fetchGithubRepos(1, false);
                              }}
                            >
                              {t("projects.tryAgain")}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {githubRepos.map((repo) => (
                          <DropdownMenuItem
                            key={`${repo.id}-${repo.fullName}`}
                            className={cn(
                              "cursor-pointer rounded-lg px-2 py-2 focus:bg-muted",
                              githubUrl.trim() === repo.htmlUrl.trim() && "bg-muted",
                            )}
                            onSelect={() => handleSelectGithubRepo(repo)}
                          >
                            <div className="flex w-full items-start gap-2">
                              <Github className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 text-left">
                                <span className="font-medium text-foreground">{repo.fullName}</span>
                                {repo.private ? (
                                  <span className="ms-2 align-middle rounded-md border border-border/80 px-1 py-px text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                                    {t("projects.private")}
                                  </span>
                                ) : null}
                                {repo.description ? (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {repo.description}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        {githubRepos.length > 0 && githubReposHasMore ? (
                          <DropdownMenuItem
                            className="cursor-pointer justify-center text-muted-foreground"
                            disabled={githubReposLoading}
                            onSelect={(e) => {
                              e.preventDefault();
                              void fetchGithubRepos(githubReposPage + 1, true);
                            }}
                          >
                            {githubReposLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                                {t("common.loading")}
                              </span>
                            ) : (
                              t("projects.loadMore")
                            )}
                          </DropdownMenuItem>
                        ) : null}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {githubUrl.trim() ? (
                    <p className="truncate rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/80">{t("projects.selected")} </span>
                      <span className="font-mono text-foreground" title={githubUrl.trim()}>
                        {githubUrl.trim()}
                      </span>
                    </p>
                  ) : null}
                </section>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="import-docker-image"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
                  >
                    {t("projects.runtimeImage")}
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
                    {dockerImageOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-full border-border/70">
                      {t("common.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={
                      submitting ||
                      (importEntries.length === 0 && !githubUrl.trim())
                    }
                    onClick={() => void handleImportContinue()}
                  >
                    {submitting && githubUrl.trim()
                      ? t("projects.importing")
                      : submitting && importEntries.length > 0
                        ? t("projects.uploading")
                        : submitting
                          ? t("projects.working")
                          : githubUrl.trim()
                            ? t("projects.importProject")
                            : importEntries.length > 0
                              ? t("projects.importFolder")
                              : t("projects.continue")}
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
