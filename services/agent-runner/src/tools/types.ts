import type OpenAI from 'openai'

/**
 * Execution context threaded into every tool call. Lets tools scope actions to
 * the owning user (the internal services have no auth/user-scoping of their own),
 * write to the agent's workspace, and guard against runaway sub-agent recursion.
 */
export interface ToolContext {
  userId: string
  agentId: string
  runId: string
  /** Sub-agent delegation depth; the top-level run is 0. */
  depth: number
}

export interface AgentTool {
  definition: OpenAI.ChatCompletionTool
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

/** Convenience: pull the tool name out of a definition. */
export function toolName(tool: AgentTool): string {
  return tool.definition.function.name
}
