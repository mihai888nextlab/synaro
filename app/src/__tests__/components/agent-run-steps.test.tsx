import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";

import { AgentRunSteps } from "@/components/ui/agents/agent-run-steps";
import { LocaleProvider } from "@/components/ui/locale-provider";
import type { ReActStep } from "@/lib/agents/react-step";

function renderSteps(steps: ReActStep[], isLive?: boolean) {
  return render(
    <SessionProvider session={null}>
      <LocaleProvider>
        <AgentRunSteps steps={steps} isLive={isLive} />
      </LocaleProvider>
    </SessionProvider>,
  );
}

describe("AgentRunSteps", () => {
  it("renders empty state when there are no steps", () => {
    renderSteps([]);
    expect(screen.getByText("No steps recorded yet.")).toBeInTheDocument();
  });

  it("renders live empty state while run is active", () => {
    renderSteps([], true);
    expect(screen.getByText("Live trace")).toBeInTheDocument();
  });

  it("renders tool name and observation preview for each step", () => {
    const steps: ReActStep[] = [
      {
        step: 1,
        tool: "web_search",
        args: { query: "Synaro" },
        observation: "Found docs about Synaro agents.",
      },
      {
        step: 2,
        tool: "finish",
        args: {},
        observation: "Completed research.",
      },
    ];

    renderSteps(steps, true);
    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText("finish")).toBeInTheDocument();
    expect(screen.getByText("Found docs about Synaro agents.")).toBeInTheDocument();
    expect(screen.getByText("Completed research.")).toBeInTheDocument();
  });
});
