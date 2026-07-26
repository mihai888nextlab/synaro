import type { EnvironmentStatus } from "@prisma/client";

import type { RemoteWorkspaceSelection, WorkspaceGitCommitLine, WorkspacePathKind } from "@/lib/workspace-selection-types";

function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
}

export type RemoteEnvironment = {
  id: string;
  projectId: string;
  status: string;
  port: number | null;
  containerId: string | null;
  image?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  /** Resolved public URL — https://{subdomain}.{domain} in production, http://localhost:{port} locally. */
  publicUrl?: string | null;
};

export async function fetchEnvironmentsForProject(projectId: string): Promise<RemoteEnvironment[]> {
  const base = environmentServiceBaseUrl();
  const url = `${base}/api/environments?projectId=${encodeURIComponent(projectId)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Environment service ${res.status}: ${t || res.statusText}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json as RemoteEnvironment[];
}

/**
 * Prefer the **newest** active runtime row (API returns environments `createdAt` desc).
 * Previously we preferred any RUNNING over any PROVISIONING, which picked a **stale** older
 * RUNNING container when a newer PROVISIONING clone existed — empty file tree while clone ran.
 */
export function pickActiveRuntimeEnvironment(rows: RemoteEnvironment[]): RemoteEnvironment | null {
  return rows.find((r) => r.status === "RUNNING" || r.status === "PROVISIONING") ?? null;
}

export async function remoteCreateEnvironment(
  projectId: string,
  image = "node:20-alpine",
  opts?: { gitRemoteUrl?: string | null; gitAccessToken?: string | null; projectSlug?: string | null },
): Promise<RemoteEnvironment> {
  const base = environmentServiceBaseUrl();
  const payload: Record<string, unknown> = { projectId, image };
  if (opts?.gitRemoteUrl) {
    payload.gitRemoteUrl = opts.gitRemoteUrl;
    if (opts.gitAccessToken) payload.gitAccessToken = opts.gitAccessToken;
  }
  if (opts?.projectSlug) payload.projectSlug = opts.projectSlug;
  const res = await fetch(`${base}/api/environments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail)
        : text;
    throw new Error(detail || `Create environment failed (${res.status})`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid create environment response");
  return parsed as RemoteEnvironment;
}

export async function remoteStartEnvironment(envId: string): Promise<RemoteEnvironment> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/start`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail?: unknown }).detail)
        : text;
    throw new Error(detail || `Start failed (${res.status})`);
  }
  if (!body || typeof body !== "object") throw new Error("Invalid start response");
  return body as RemoteEnvironment;
}

export async function remoteStopEnvironment(envId: string): Promise<RemoteEnvironment> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/stop`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail?: unknown }).detail)
        : text;
    throw new Error(detail || `Stop failed (${res.status})`);
  }
  if (!body || typeof body !== "object") throw new Error("Invalid stop response");
  return body as RemoteEnvironment;
}

export async function remoteListWorkspaceFiles(envId: string): Promise<{
  paths: string[];
  truncated: boolean;
  rootLabel: string;
  inactive?: boolean;
  clonePending?: boolean;
}> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-files`, {
    method: "GET",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail)
        : parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error?: unknown }).error)
          : text;
    throw new Error(detail || `List workspace files failed (${res.status})`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid workspace-files response");
  const o = parsed as {
    paths?: unknown;
    truncated?: unknown;
    rootLabel?: unknown;
    inactive?: unknown;
    clonePending?: unknown;
  };
  const paths = Array.isArray(o.paths) ? o.paths.filter((p): p is string => typeof p === "string") : [];
  const truncated = Boolean(o.truncated);
  const rootLabel = typeof o.rootLabel === "string" && o.rootLabel.length > 0 ? o.rootLabel : "repository";
  const inactive = Boolean(o.inactive);
  const clonePending = Boolean(o.clonePending);
  return { paths, truncated, rootLabel, inactive, clonePending };
}

export async function remoteWorkspaceSelection(envId: string, path: string): Promise<RemoteWorkspaceSelection> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(
    `${base}/api/environments/${encodeURIComponent(envId)}/workspace-selection?path=${encodeURIComponent(path)}`,
    { method: "GET", signal: AbortSignal.timeout(120_000) },
  );
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail)
        : parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error?: unknown }).error)
          : text;
    throw new Error(detail || `Workspace selection failed (${res.status})`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid workspace-selection response");
  const o = parsed as Record<string, unknown>;
  const pathOut = typeof o.path === "string" ? o.path : path;
  const kindRaw = typeof o.kind === "string" ? o.kind : "missing";
  const kind: WorkspacePathKind =
    kindRaw === "file" || kindRaw === "directory" || kindRaw === "missing" || kindRaw === "notfile"
      ? kindRaw
      : "missing";
  const content = typeof o.content === "string" || o.content === null ? (o.content as string | null) : null;
  const contentTruncated = Boolean(o.contentTruncated);
  const gitLog: WorkspaceGitCommitLine[] = Array.isArray(o.gitLog)
    ? (o.gitLog as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          shortSha: String(r.shortSha ?? ""),
          author: String(r.author ?? ""),
          date: String(r.date ?? ""),
          subject: String(r.subject ?? ""),
        };
      })
    : [];
  return { path: pathOut, kind, content, contentTruncated, gitLog };
}

export async function remoteWriteWorkspaceFile(envId: string, relativePath: string, content: string): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, content }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Write workspace file failed (${res.status})`);
  }
}

/** Write raw bytes (e.g. an uploaded image) into the workspace. `base64` is base64 of the file bytes. */
export async function remoteWriteWorkspaceFileBinary(
  envId: string,
  relativePath: string,
  base64: string,
): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath, content: base64, encoding: "base64" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Write workspace file failed (${res.status})`);
  }
}

export async function remoteDeleteWorkspacePath(envId: string, relativePath: string): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Delete workspace path failed (${res.status})`);
  }
}

export async function remoteCreateWorkspaceDirectory(envId: string, relativePath: string): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: relativePath }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Create workspace directory failed (${res.status})`);
  }
}

export async function remoteRenameWorkspacePath(
  envId: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/workspace-rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromPath, to: toPath }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Rename workspace path failed (${res.status})`);
  }
}

export async function remoteDestroyEnvironment(
  envId: string,
  opts?: { purgeVolume?: boolean },
): Promise<void> {
  const base = environmentServiceBaseUrl();
  // Only purge the persistent workspace volume on true project deletion — never on the recreate flow.
  const query = opts?.purgeVolume ? "?purgeVolume=1" : "";
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}${query}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok && res.status !== 204) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Delete environment failed (${res.status})`);
  }
}

/** Best-effort: remove every environment row for a project (Docker containers + DB rows in env service). */
export async function destroyAllRemoteEnvironmentsForProject(projectId: string): Promise<void> {
  let rows: RemoteEnvironment[] = [];
  try {
    rows = await fetchEnvironmentsForProject(projectId);
  } catch {
    /* listing failed — still allow the app project row to be deleted */
    return;
  }
  for (const row of rows) {
    try {
      // Project is being deleted — also remove the persistent workspace volume.
      await remoteDestroyEnvironment(row.id, { purgeVolume: true });
    } catch {
      /* continue — still delete app project row */
    }
  }
}

export async function remoteExecTerminal(
  envId: string,
  command: string,
): Promise<{ output: string; exitCode: number | null; cwd: string }> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}/terminal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error?: unknown }).error)
        : parsed && typeof parsed === "object" && parsed !== null && "detail" in parsed
          ? String((parsed as { detail?: unknown }).detail)
          : text;
    const err = new Error(detail || `Terminal exec failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid terminal response");
  const o = parsed as Record<string, unknown>;
  return {
    output: typeof o.output === "string" ? o.output : "",
    exitCode: typeof o.exitCode === "number" ? o.exitCode : null,
    cwd: typeof o.cwd === "string" ? o.cwd : "/tmp/synaro-workspace/app",
  };
}

export function parseRemoteStatus(s: string): EnvironmentStatus | null {
  const allowed: EnvironmentStatus[] = [
    "INACTIVE",
    "PROVISIONING",
    "RUNNING",
    "STOPPED",
    "ERROR",
  ];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : null;
}
