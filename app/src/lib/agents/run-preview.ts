import type { AgentRun } from "@/lib/agents/agent-types";
import type { ReActStep } from "@/lib/agents/react-step";

export type RunPreviewVariant = "compact" | "expanded" | "embedded";

const PREVIEW_MAX_LENGTH: Record<RunPreviewVariant, number> = {
  compact: 180,
  expanded: 4000,
  embedded: 4000,
};

export type GetRunCardPreviewOptions = {
  variant?: RunPreviewVariant;
};

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

export function truncatePreview(
  text: string,
  maxLength: number = PREVIEW_MAX_LENGTH.compact,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function previewFromText(
  text: string | null | undefined,
  variant: RunPreviewVariant,
): string | null {
  if (!text?.trim()) return null;
  const maxLength = PREVIEW_MAX_LENGTH[variant];
  const source = variant === "compact" ? stripBasicMarkdown(text) : text.trim();
  return truncatePreview(source, maxLength);
}

function lastStepObservation(steps: ReActStep[], variant: RunPreviewVariant): string | null {
  if (steps.length === 0) return null;
  const last = steps[steps.length - 1];
  return previewFromText(last?.observation, variant);
}

function finishAnswerFromSteps(steps: ReActStep[], variant: RunPreviewVariant): string | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step?.tool === "finish") {
      return previewFromText(step.observation, variant);
    }
  }
  return null;
}

export function resolveRunOutputText(run: AgentRun): string | null {
  if (run.output?.trim()) return run.output.trim();
  const steps = normalizeSteps(run.steps);
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step?.tool === "finish" && step.observation.trim()) {
      return step.observation.trim();
    }
  }
  return null;
}

export function getRunCardPreview(
  run: AgentRun,
  labels: RunCardPreviewLabels,
  options: GetRunCardPreviewOptions = {},
): RunCardPreview {
  const variant = options.variant ?? "compact";
  const steps = normalizeSteps(run.steps);

  switch (run.status) {
    case "DONE": {
      const text =
        previewFromText(run.output, variant) ?? finishAnswerFromSteps(steps, variant);
      return text
        ? { kind: "output", text }
        : { kind: "empty", text: labels.noOutput ?? "" };
    }
    case "FAILED": {
      const text = previewFromText(run.output, variant);
      return text
        ? { kind: "error", text }
        : { kind: "empty", text: labels.noOutput ?? "" };
    }
    case "RUNNING":
    case "PENDING": {
      // Finish already ran but status may still be stuck as RUNNING (webhook lag/failure).
      const finished = finishAnswerFromSteps(steps, variant);
      if (finished) return { kind: "output", text: finished };
      const fromStep = lastStepObservation(steps, variant);
      if (fromStep) return { kind: "activity", text: fromStep };
      const fromInput = previewFromText(run.input, variant);
      if (fromInput) return { kind: "activity", text: fromInput };
      return { kind: "activity", text: labels.running };
    }
    case "NEEDS_INPUT": {
      const server = run.credentialRequest?.server?.trim() || "MCP";
      return { kind: "needs-input", text: labels.needsInput(server), server };
    }
    case "CANCELLED": {
      const text = previewFromText(run.output, variant);
      return text ? { kind: "cancelled", text } : { kind: "cancelled", text: labels.cancelled };
    }
    default: {
      const text = previewFromText(run.output, variant) ?? previewFromText(run.input, variant);
      return text ? { kind: "output", text } : { kind: "empty", text: labels.noOutput ?? "" };
    }
  }
}
