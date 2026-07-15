import type { AgentRun } from "@/lib/agents/agent-types";
import {
  getRunCardPreview,
  normalizeSteps,
  stripBasicMarkdown,
  truncatePreview,
} from "@/lib/agents/run-preview";

const labels = {
  running: "Running…",
  needsInput: (server: string) => `Waiting for ${server} credentials`,
  cancelled: "Cancelled",
  noOutput: "No output yet",
};

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run-1",
    status: "DONE",
    trigger: "manual",
    createdAt: "2026-07-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("run-preview", () => {
  describe("stripBasicMarkdown", () => {
    it("strips headings, bold, links, and code fences", () => {
      const raw = "# Title\n\n**Bold** and [link](https://x.test) with `code`.\n```js\nconst x = 1;\n```";
      expect(stripBasicMarkdown(raw)).toBe("Title Bold and link with code.");
    });
  });

  describe("truncatePreview", () => {
    it("truncates long text with ellipsis", () => {
      const long = "a".repeat(200);
      const result = truncatePreview(long, 180);
      expect(result.length).toBe(180);
      expect(result.endsWith("…")).toBe(true);
    });

    it("leaves short text unchanged", () => {
      expect(truncatePreview("hello")).toBe("hello");
    });
  });

  describe("normalizeSteps", () => {
    it("filters invalid step entries", () => {
      const steps = normalizeSteps([
        { step: 1, tool: "web_search", args: {}, observation: "ok" },
        { step: "bad", tool: "x" } as never,
        null as never,
      ]);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.tool).toBe("web_search");
    });
  });

  describe("getRunCardPreview", () => {
    it("returns output preview for DONE runs", () => {
      const preview = getRunCardPreview(
        makeRun({ status: "DONE", output: "**Synaro** is great." }),
        labels,
      );
      expect(preview).toEqual({ kind: "output", text: "Synaro is great." });
    });

    it("returns error snippet for FAILED runs from output", () => {
      const preview = getRunCardPreview(
        makeRun({
          status: "FAILED",
          output: "Could not connect to MCP server.",
        }),
        labels,
      );
      expect(preview).toEqual({
        kind: "error",
        text: "Could not connect to MCP server.",
      });
    });

    it("prefers last step observation for RUNNING runs", () => {
      const preview = getRunCardPreview(
        makeRun({
          status: "RUNNING",
          input: "Find docs",
          steps: [
            {
              step: 1,
              tool: "web_search",
              args: {},
              observation: "Found several results about Synaro.",
            },
          ],
        }),
        labels,
      );
      expect(preview).toEqual({
        kind: "activity",
        text: "Found several results about Synaro.",
      });
    });

    it("falls back to input then running label for active runs", () => {
      const fromInput = getRunCardPreview(
        makeRun({ status: "PENDING", input: "Check Synaro docs" }),
        labels,
      );
      expect(fromInput).toEqual({ kind: "activity", text: "Check Synaro docs" });

      const fromLabel = getRunCardPreview(makeRun({ status: "RUNNING" }), labels);
      expect(fromLabel).toEqual({ kind: "activity", text: "Running…" });
    });

    it("returns needs-input preview with server name", () => {
      const preview = getRunCardPreview(
        makeRun({
          status: "NEEDS_INPUT",
          credentialRequest: {
            server: "github",
            url: "https://example.com",
            fields: [{ key: "Authorization", label: "Token", type: "password" }],
          },
        }),
        labels,
      );
      expect(preview).toEqual({
        kind: "needs-input",
        text: "Waiting for github credentials",
        server: "github",
      });
    });

    it("returns cancelled output or label", () => {
      const withOutput = getRunCardPreview(
        makeRun({ status: "CANCELLED", output: "Cancelled by user" }),
        labels,
      );
      expect(withOutput).toEqual({ kind: "cancelled", text: "Cancelled by user" });

      const withoutOutput = getRunCardPreview(makeRun({ status: "CANCELLED" }), labels);
      expect(withoutOutput).toEqual({ kind: "cancelled", text: "Cancelled" });
    });
  });
});
