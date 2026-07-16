import { describe, expect, it, vi } from "vitest";

import { runCli } from "../cli/run.js";
import { parseArgv } from "../cli/util.js";
import { Synaro } from "../synaro.js";

describe("CLI parseArgv", () => {
  it("splits positional args and flags", () => {
    expect(parseArgv(["projects", "deploy", "p1", "--no-wait", "--help"])).toEqual({
      args: ["projects", "deploy", "p1"],
      flags: new Set(["no-wait", "help"]),
    });
  });
});

describe("CLI runCli", () => {
  it("prints help with no args", async () => {
    const lines: string[] = [];
    const code = await runCli({
      argv: [],
      io: {
        stdout: (l) => lines.push(l),
        stderr: () => {},
      },
      client: new Synaro({ apiKey: "sk_live_x", fetch: vi.fn() as unknown as typeof fetch }),
    });
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Usage: synaro");
  });

  it("me prints JSON via injectable client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "u1",
          email: "a@b.c",
          name: "Ada",
          created_at: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const lines: string[] = [];
    const code = await runCli({
      argv: ["me"],
      client: new Synaro({
        apiKey: "sk_live_x",
        baseUrl: "https://api.test",
        fetch: fetchMock as unknown as typeof fetch,
        retryOnRateLimit: false,
      }),
      io: {
        stdout: (l) => lines.push(l),
        stderr: () => {},
      },
    });
    expect(code).toBe(0);
    expect(JSON.parse(lines.join(""))).toMatchObject({ userId: "u1", email: "a@b.c" });
  });

  it("fails clearly without SYNARO_API_KEY when no client injected", async () => {
    const err: string[] = [];
    const code = await runCli({
      argv: ["me"],
      env: {},
      io: {
        stdout: () => {},
        stderr: (l) => err.push(l),
      },
    });
    expect(code).toBe(1);
    expect(err.join("")).toMatch(/SYNARO_API_KEY/);
  });

  it("projects deploy --no-wait calls deploy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          environment_status: "RUNNING",
          run_status: "ok",
          preview_url: "http://x",
          command: "npm start",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const lines: string[] = [];
    const code = await runCli({
      argv: ["projects", "deploy", "proj-1", "--no-wait"],
      client: new Synaro({
        apiKey: "sk_live_x",
        baseUrl: "https://api.test",
        fetch: fetchMock as unknown as typeof fetch,
        retryOnRateLimit: false,
      }),
      io: {
        stdout: (l) => lines.push(l),
        stderr: () => {},
      },
    });
    expect(code).toBe(0);
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.wait_until_ready).toBe(false);
    expect(JSON.parse(lines.join(""))).toMatchObject({ environmentStatus: "RUNNING" });
  });
});
