import type { SynaroHttpClient } from "../client.js";
import type { Me } from "../types.js";

export class MeResource {
  constructor(private readonly http: SynaroHttpClient) {}

  /** Verify the API key and return the authenticated user. */
  me(): Promise<Me> {
    return this.http.request<Me>("/api/v1/me");
  }
}
