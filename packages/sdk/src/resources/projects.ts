import { toSnakeCase } from "../case.js";
import type { SynaroHttpClient } from "../client.js";
import type {
  CreateProjectInput,
  DeployOptions,
  DeployResult,
  EnsureRunningOptions,
  EnvironmentControlResult,
  LogsOptions,
  LogsResult,
  Project,
  StatusResponse,
} from "../types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ProjectsResource {
  constructor(private readonly http: SynaroHttpClient) {}

  async list(): Promise<Project[]> {
    const res = await this.http.request<{ projects: Project[] }>("/api/v1/projects");
    return res.projects ?? [];
  }

  create(input: CreateProjectInput = {}): Promise<Project> {
    return this.http.request<Project>("/api/v1/projects", {
      method: "POST",
      body: toSnakeCase(input),
    });
  }

  get(projectId: string): Promise<Project> {
    return this.http.request<Project>(`/api/v1/projects/${encodeURIComponent(projectId)}`);
  }

  delete(projectId: string): Promise<void> {
    return this.http.request<void>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      empty: true,
    });
  }

  start(projectId: string): Promise<EnvironmentControlResult> {
    return this.http.request<EnvironmentControlResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/environment/start`,
      { method: "POST", body: {} },
    );
  }

  stop(projectId: string): Promise<EnvironmentControlResult> {
    return this.http.request<EnvironmentControlResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/environment/stop`,
      { method: "POST", body: {} },
    );
  }

  deploy(projectId: string, opts: DeployOptions = {}): Promise<DeployResult> {
    return this.http.request<DeployResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/deploy`,
      {
        method: "POST",
        body: toSnakeCase({
          waitUntilReady: opts.waitUntilReady !== false,
          timeoutSeconds: opts.timeoutSeconds,
        }),
        timeoutMs: Math.max(
          this.http.timeoutMs,
          ((opts.timeoutSeconds ?? 300) + 30) * 1000,
        ),
      },
    );
  }

  logs(projectId: string, opts: LogsOptions = {}): Promise<LogsResult> {
    return this.http.request<LogsResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/logs`,
      {
        query: {
          source: opts.source,
          lines: opts.lines,
          task_id: opts.taskId,
        },
      },
    );
  }

  /**
   * Start the environment if needed and poll status until run-ready or timeout.
   */
  async ensureRunning(
    projectId: string,
    opts: EnsureRunningOptions = {},
  ): Promise<StatusResponse> {
    const timeoutMs = opts.timeoutMs ?? 180_000;
    const pollIntervalMs = opts.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;

    let status = await this.http.request<StatusResponse>("/api/v1/status", {
      query: { project_id: projectId },
    });

    const ready = () => Boolean(status.project?.runReady);
    if (ready()) return status;

    try {
      await this.start(projectId);
    } catch (err) {
      // 409 already provisioning is fine — keep polling
      const statusCode = (err as { status?: number }).status;
      if (statusCode !== 409) throw err;
    }

    while (Date.now() < deadline) {
      await sleep(pollIntervalMs);
      status = await this.http.request<StatusResponse>("/api/v1/status", {
        query: { project_id: projectId },
      });
      if (ready()) return status;
    }

    throw new Error(`Project ${projectId} did not become run-ready within ${timeoutMs}ms`);
  }

  async withPreview(
    projectId: string,
    opts?: DeployOptions,
  ): Promise<{ project: Project; previewUrl: string | null; deploy: DeployResult }> {
    const deploy = await this.deploy(projectId, opts);
    const project = await this.get(projectId);
    return { project, previewUrl: deploy.previewUrl ?? null, deploy };
  }
}
