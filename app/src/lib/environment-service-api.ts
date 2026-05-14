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

/** Prefer a live runtime row (newest RUNNING, else newest PROVISIONING). `rows` should be newest-first from the API. */
export function pickActiveRuntimeEnvironment(rows: RemoteEnvironment[]): RemoteEnvironment | null {
  const running = rows.filter((r) => r.status === "RUNNING");
  if (running.length > 0) return running[0]!;
  const provisioning = rows.filter((r) => r.status === "PROVISIONING");
  if (provisioning.length > 0) return provisioning[0]!;
  return null;
}

export async function remoteCreateEnvironment(
  projectId: string,
  image = "node:20-alpine",
  opts?: { gitRemoteUrl?: string | null; gitAccessToken?: string | null },
): Promise<RemoteEnvironment> {
  const base = environmentServiceBaseUrl();
  const payload: Record<string, unknown> = { projectId, image };
  if (opts?.gitRemoteUrl) {
    payload.gitRemoteUrl = opts.gitRemoteUrl;
    if (opts.gitAccessToken) payload.gitAccessToken = opts.gitAccessToken;
  }
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

export async function remoteDestroyEnvironment(envId: string): Promise<void> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments/${encodeURIComponent(envId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok && res.status !== 204) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Delete environment failed (${res.status})`);
  }
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
