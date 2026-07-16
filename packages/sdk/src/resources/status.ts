import type { SynaroHttpClient } from "../client.js";
import type { StatusResponse } from "../types.js";

export class StatusResource {
  constructor(private readonly http: SynaroHttpClient) {}

  /** Platform health; optionally include project readiness. */
  status(opts?: { projectId?: string }): Promise<StatusResponse> {
    return this.http.request<StatusResponse>("/api/v1/status", {
      query: { project_id: opts?.projectId },
    });
  }
}
