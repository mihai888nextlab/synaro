import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  destroyAllRemoteEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  parseRemoteStatus,
  remoteListWorkspaceFiles,
} from "@/lib/environment-service-api";
import type { RemoteEnvironment } from "@/lib/environment-service-api";

describe("pickActiveRuntimeEnvironment", () => {
  it("returns the first RUNNING row when API returns newest-first ordering", () => {
    const rows: RemoteEnvironment[] = [
      { id: "newer", projectId: "p", status: "RUNNING", port: 1, containerId: "a" },
      { id: "older", projectId: "p", status: "RUNNING", port: 2, containerId: "b" },
    ];
    expect(pickActiveRuntimeEnvironment(rows)?.id).toBe("newer");
  });

  it("falls back to first PROVISIONING when nothing is RUNNING (warmup / clone phase)", () => {
    const rows: RemoteEnvironment[] = [
      { id: "p1", projectId: "p", status: "PROVISIONING", port: null, containerId: "c" },
      { id: "s1", projectId: "p", status: "STOPPED", port: null, containerId: null },
    ];
    expect(pickActiveRuntimeEnvironment(rows)?.id).toBe("p1");
  });

  it("prefers the newest list row when both PROVISIONING and older RUNNING exist (avoid stale container)", () => {
    const rows: RemoteEnvironment[] = [
      { id: "new-prov", projectId: "p", status: "PROVISIONING", port: null, containerId: null },
      { id: "old-run", projectId: "p", status: "RUNNING", port: 1, containerId: "x" },
    ];
    expect(pickActiveRuntimeEnvironment(rows)?.id).toBe("new-prov");
  });

  it("returns null when fleet is idle (STOPPED/ERROR only)", () => {
    const rows: RemoteEnvironment[] = [
      { id: "a", projectId: "p", status: "STOPPED", port: null, containerId: null },
      { id: "b", projectId: "p", status: "ERROR", port: null, containerId: null },
    ];
    expect(pickActiveRuntimeEnvironment(rows)).toBeNull();
  });
});

describe("parseRemoteStatus", () => {
  it.each([
    ["RUNNING", "RUNNING"],
    ["PROVISIONING", "PROVISIONING"],
    ["STOPPED", "STOPPED"],
    ["INACTIVE", "INACTIVE"],
    ["ERROR", "ERROR"],
  ])("accepts canonical status %s", (raw, expected) => {
    expect(parseRemoteStatus(raw)).toBe(expected);
  });

  it("returns null for unknown garbage from a buggy upstream", () => {
    expect(parseRemoteStatus("FLYING")).toBeNull();
    expect(parseRemoteStatus("")).toBeNull();
  });
});

describe("remoteListWorkspaceFiles (fetch integration contract)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ENVIRONMENT_SERVICE_URL = "http://env.test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ENVIRONMENT_SERVICE_URL;
  });

  it("throws with upstream detail when HTTP status is not ok (operator visibility)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: "bad gateway", detail: "upstream" }),
    });

    await expect(remoteListWorkspaceFiles("env-1")).rejects.toThrow(/502|upstream|bad gateway/i);
  });

  it("parses inactive and clonePending sentinel flags from JSON payload", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          paths: [],
          truncated: false,
          rootLabel: "r",
          inactive: true,
          clonePending: false,
        }),
    });

    const out = await remoteListWorkspaceFiles("env-1");
    expect(out.inactive).toBe(true);
    expect(out.clonePending).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://env.test/api/environments/env-1/workspace-files",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("destroyAllRemoteEnvironmentsForProject", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ENVIRONMENT_SERVICE_URL = "http://env.test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ENVIRONMENT_SERVICE_URL;
  });

  it("swallows list failures so project delete can still proceed", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(destroyAllRemoteEnvironmentsForProject("project-1")).resolves.toBeUndefined();
  });

  it("continues when an individual environment destroy fails", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/environments?")) {
        return {
          ok: true,
          json: async () => [
            { id: "e1", projectId: "p", status: "STOPPED", port: null, containerId: null },
            { id: "e2", projectId: "p", status: "STOPPED", port: null, containerId: null },
          ],
        } as Response;
      }
      return { ok: false, status: 500, text: async () => "boom" } as Response;
    }) as unknown as typeof fetch;

    await expect(destroyAllRemoteEnvironmentsForProject("project-1")).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
