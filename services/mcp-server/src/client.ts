export class SynaroApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = (opts?.baseUrl ?? process.env.SYNARO_APP_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    this.apiKey = opts?.apiKey ?? process.env.SYNARO_API_KEY ?? "";
    if (!this.apiKey.trim()) {
      throw new Error("SYNARO_API_KEY is required");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(300_000),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = data as { error?: string; detail?: string };
      throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`);
    }
    return data as T;
  }

  createProject(input: {
    name: string;
    description?: string;
    repository_url?: string;
    docker_image?: string;
  }) {
    return this.request<{
      project_id: string;
      slug: string;
      name: string;
      environment_status: string;
      environment_warning: string | null;
    }>("POST", "/api/mcp/projects", input);
  }

  deployProject(
    projectId: string,
    input?: { wait_until_ready?: boolean; timeout_seconds?: number },
  ) {
    return this.request<{
      environment_status: string;
      run_status: string;
      preview_url: string | null;
      command: string;
    }>("POST", `/api/mcp/projects/${encodeURIComponent(projectId)}/deploy`, input ?? {});
  }

  getLogs(
    projectId: string,
    input?: { source?: "runtime" | "task"; task_id?: string; lines?: number },
  ) {
    const params = new URLSearchParams();
    if (input?.source) params.set("source", input.source);
    if (input?.task_id) params.set("task_id", input.task_id);
    if (input?.lines != null) params.set("lines", String(input.lines));
    const q = params.toString();
    return this.request<{ source: string; lines: string[] }>(
      "GET",
      `/api/mcp/projects/${encodeURIComponent(projectId)}/logs${q ? `?${q}` : ""}`,
    );
  }

  createAgent(
    projectId: string,
    input: { prompt: string; mode?: "generate" | "answer" },
  ) {
    return this.request<{ task_id: string; status: string; poll_with: string }>(
      "POST",
      `/api/mcp/projects/${encodeURIComponent(projectId)}/agents`,
      input,
    );
  }

  runAgent(
    taskId: string,
    input?: { wait?: boolean; timeout_seconds?: number },
  ) {
    const params = new URLSearchParams();
    if (input?.wait === false) params.set("wait", "false");
    if (input?.timeout_seconds != null) {
      params.set("timeout_seconds", String(input.timeout_seconds));
    }
    const q = params.toString();
    return this.request<Record<string, unknown>>(
      "GET",
      `/api/mcp/agents/${encodeURIComponent(taskId)}${q ? `?${q}` : ""}`,
    );
  }

  getSystemStatus(projectId?: string) {
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    return this.request<Record<string, unknown>>("GET", `/api/mcp/system/status${q}`);
  }
}
