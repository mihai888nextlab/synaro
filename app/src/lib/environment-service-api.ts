import type { EnvironmentStatus } from "@prisma/client";

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

export async function remoteCreateEnvironment(projectId: string, image = "node:20-alpine"): Promise<RemoteEnvironment> {
  const base = environmentServiceBaseUrl();
  const res = await fetch(`${base}/api/environments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, image }),
    signal: AbortSignal.timeout(300_000),
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
    throw new Error(detail || `Create environment failed (${res.status})`);
  }
  if (!body || typeof body !== "object") throw new Error("Invalid create environment response");
  return body as RemoteEnvironment;
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
