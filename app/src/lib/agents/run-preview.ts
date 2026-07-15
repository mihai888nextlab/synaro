import type { AgentRun } from "@/lib/agents/agent-types";
import type { ReActStep } from "@/lib/agents/react-step";

const PREVIEW_MAX_LENGTH = 180;

export type RunCardPreviewLabels = {
  running: string;
  needsInput: (server: string) => string;
  cancelled: string;
  noOutput?: string;
};

export type RunCardPreview =
  | { kind: "output"; text: string }
  | { kind: "error"; text: string }
  | { kind: "activity"; text: string }
  | { kind: "needs-input"; text: string; server: string }
  | { kind: "cancelled"; text: string }
  | { kind: "empty"; text: string };

export function normalizeSteps(steps: AgentRun["steps"]): ReActStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter(
    (step): step is ReActStep =>
      typeof step === "object" &&
      step !== null &&
      typeof (step as ReActStep).step === "number" &&
      typeof (step as ReActStep).tool === "string",
  );
}

export function stripBasicMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncatePreview(text: string, maxLength = PREVIEW_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function previewFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  return truncatePreview(stripBasicMarkdown(text));
}

function lastStepObservation(steps: ReActStep[]): string | null {
  if (steps.length === 0) return null;
  const last = steps[steps.length - 1];
  return previewFromText(last?.observation);
}

export function getRunCardPreview(run: AgentRun, labels: RunCardPreviewLabels): RunCardPreview {
  const steps = normalizeSteps(run.steps);

  switch (run.status) {
    case "DONE": {
      const text = previewFromText(run.output);
      return text
        ? { kind: "output", text }
        : { kind: "empty", text: labels.noOutput ?? "" };
    }
    case "FAILED": {
      const text = previewFromText(run.output);
      return text
        ? { kind: "error", text }
        : { kind: "empty", text: labels.noOutput ?? "" };
    }
    case "RUNNING":
    case "PENDING": {
      const fromStep = lastStepObservation(steps);
      if (fromStep) return { kind: "activity", text: fromStep };
      const fromInput = previewFromText(run.input);
      if (fromInput) return { kind: "activity", text: fromInput };
      return { kind: "activity", text: labels.running };
    }
    case "NEEDS_INPUT": {
      const server = run.credentialRequest?.server?.trim() || "MCP";
      return { kind: "needs-input", text: labels.needsInput(server), server };
    }
    case "CANCELLED": {
      const text = previewFromText(run.output);
      return text ? { kind: "cancelled", text } : { kind: "cancelled", text: labels.cancelled };
    }
    default: {
      const text = previewFromText(run.output) ?? previewFromText(run.input);
      return text ? { kind: "output", text } : { kind: "empty", text: labels.noOutput ?? "" };
    }
  }
}
