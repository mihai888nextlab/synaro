import {
  buildAgentCreateBody,
  buildAgentUpdateBody,
  DEFAULT_AGENT_FORM_VALUES,
} from "@/lib/agents/agent-types";

describe("agent-types emailOnComplete", () => {
  it("includes emailOnComplete in create body", () => {
    const body = buildAgentCreateBody({
      ...DEFAULT_AGENT_FORM_VALUES,
      name: "Research",
      systemPrompt: "Do research",
      emailOnComplete: true,
    });
    expect(body.emailOnComplete).toBe(true);
  });

  it("includes emailOnComplete in update body", () => {
    const body = buildAgentUpdateBody({
      ...DEFAULT_AGENT_FORM_VALUES,
      name: "Research",
      systemPrompt: "Do research",
      emailOnComplete: false,
    });
    expect(body.emailOnComplete).toBe(false);
  });
});
