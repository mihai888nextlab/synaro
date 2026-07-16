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

    it("preserves markdown and allows longer text in expanded variant", () => {
      const markdown = "# Title\n\n**Bold** paragraph with `code`.";
      const preview = getRunCardPreview(
        makeRun({ status: "DONE", output: markdown }),
        labels,
        { variant: "expanded" },
      );
      expect(preview).toEqual({ kind: "output", text: markdown });
    });

    it("preserves markdown in embedded variant", () => {
      const markdown = "## Summary\n\n- First item\n- **Second** item";
      const preview = getRunCardPreview(
        makeRun({ status: "DONE", output: markdown }),
        labels,
        { variant: "embedded" },
      );
      expect(preview).toEqual({ kind: "output", text: markdown });
    });

    it("truncates expanded previews at 4000 characters", () => {
      const long = "word ".repeat(900).trim();
      const preview = getRunCardPreview(
        makeRun({ status: "DONE", output: long }),
        labels,
        { variant: "expanded" },
      );
      expect(preview.kind).toBe("output");
      if (preview.kind === "output") {
        expect(preview.text.length).toBe(4000);
        expect(preview.text.endsWith("…")).toBe(true);
      }
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
        text: "web_search · Found several results about Synaro.",
      });
    });

    it("summarizes bulky HTML http_get observations instead of rendering them", () => {
      const html = `HTTP 200 OK\n\n<!doctype html><html><head><title>x</title></head><body>${"a".repeat(12_000)}</body></html>`;
      const preview = getRunCardPreview(
        makeRun({
          status: "RUNNING",
          steps: [
            {
              step: 1,
              tool: "http_get",
              args: { url: "https://example.com" },
              observation: html,
            },
          ],
        }),
        labels,
        { variant: "embedded" },
      );
      expect(preview.kind).toBe("activity");
      if (preview.kind === "activity") {
        expect(preview.text).toMatch(/^http_get · ~\d+ KB$/);
        expect(preview.text).not.toContain("<!doctype");
      }
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

    it("treats finish observation as output when status is still running", () => {
      const preview = getRunCardPreview(
        makeRun({
          status: "RUNNING",
          output: null,
          steps: [
            { step: 0, tool: "http_get", args: {}, observation: "HTTP 200 OK {...}" },
            {
              step: 1,
              tool: "finish",
              args: { answer: "## S&P 500\n\nCurrent price **7572**" },
              observation: "## S&P 500\n\nCurrent price **7572**",
            },
          ],
        }),
        labels,
        { variant: "expanded" },
      );
      expect(preview.kind).toBe("output");
      if (preview.kind === "output") {
        expect(preview.text).toContain("S&P 500");
      }
    });
  });
});
