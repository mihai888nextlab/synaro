/** Node/undici often throws `TypeError: fetch failed` with no detail when upstream is down. */
function isUnreachableUpstreamError(message: string): boolean {
  return /fetch failed|failed to fetch|econnrefused|econnreset|enotfound|network\s*error/i.test(message);
}

export function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
}

export function formatEnvironmentProvisionFailure(err: unknown): string {
  const chain =
    err instanceof Error
      ? [err.message, err.cause instanceof Error ? err.cause.message : String(err.cause ?? "")]
          .filter(Boolean)
          .join(" ")
      : String(err);
  const base = environmentServiceBaseUrl();
  if (isUnreachableUpstreamError(chain)) {
    return `Could not reach the environment service at ${base}. From the repo root run: docker compose up -d postgresql-env environment-service`;
  }
  return err instanceof Error ? err.message : String(err);
}

export type EnvServiceRow = {
  id: string;
  projectId: string;
  status: string;
  port?: number | null;
  image?: string;
  containerId?: string | null;
  updatedAt?: string | Date;
};

export async function provisionProjectEnvironment(
  projectId: string,
  image: string,
  opts?: {
    gitRemoteUrl?: string | null;
    gitAccessToken?: string | null;
    /** Per-tier container memory in MB (env-service falls back to its default if absent). */
    memoryMb?: number;
    /** Per-tier container CPU in nano-CPUs (1e9 = 1 CPU). */
    nanoCpus?: number;
  },
): Promise<EnvServiceRow> {
  const base = environmentServiceBaseUrl();
  const body: Record<string, string | number> = { projectId, image };
  if (opts?.gitRemoteUrl) {
    body.gitRemoteUrl = opts.gitRemoteUrl;
    if (opts.gitAccessToken) body.gitAccessToken = opts.gitAccessToken;
  }
  if (typeof opts?.memoryMb === "number") body.memoryMb = opts.memoryMb;
  if (typeof opts?.nanoCpus === "number") body.nanoCpus = opts.nanoCpus;
  let res: Response;
  try {
    res = await fetch(`${base}/api/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(formatEnvironmentProvisionFailure(err));
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail =
      json && typeof json === "object" && json !== null && "detail" in json
        ? String((json as { detail?: unknown }).detail)
        : text;
    throw new Error(`Environment service ${res.status}: ${detail || res.statusText}`);
  }
  if (!json || typeof json !== "object") throw new Error("Invalid environment service response");
  return json as EnvServiceRow;
}

export async function uploadWorkspaceTarToEnvironment(environmentId: string, tar: Buffer): Promise<void> {
  const base = environmentServiceBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/api/environments/${encodeURIComponent(environmentId)}/workspace-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(tar),
    });
  } catch (err) {
    throw new Error(formatEnvironmentProvisionFailure(err));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string; detail?: string };
      msg = [j.error, j.detail].filter(Boolean).join(": ") || text;
    } catch {
      /* plain text */
    }
    throw new Error(msg || `Workspace upload failed (${res.status})`);
  }
}
