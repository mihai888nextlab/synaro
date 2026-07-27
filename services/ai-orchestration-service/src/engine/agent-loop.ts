import type OpenAI from 'openai'
import { chatWithTools, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { AGENT_TOOLS, executeAgentTool, toolActivityLabel } from './agent-tools.js'
import { DESIGN_GUIDE } from './design-guide.js'

const AGENT_SYSTEM = `You are an autonomous coding agent working directly inside a project's live workspace using tools.

Work in a loop: inspect with list_files/read_file, change with edit_file/write_file, optionally verify with run_command, then call finish.

Rules:
- ALWAYS read a file with read_file before editing it, and copy the "search" text VERBATIM from what you read (exact characters and indentation).
- Make the SMALLEST change that satisfies the request. Prefer edit_file over rewriting whole files with write_file.
- Do NOT ask the user questions — the framework, language, and styling are already fixed (see context). Proceed with sensible defaults.
- For Next.js: never set distDir in next.config.*; never use output: 'export' or 'standalone'; keep a "next dev" script; the app must bind to process.env.PORT (default 3000).
- When your files are UI (markup, components, styles), hold them to the design bar below.
- Be efficient — you have a limited number of steps. When the change is complete, call finish with a one-sentence summary. Do not call finish before the change is done.

${DESIGN_GUIDE}`

export type AgentLoopResult = {
  summary: string
  /** Files created/modified during the run. */
  touched: string[]
  /** Content of each touched file BEFORE the run (null = newly created), for accurate diffs. */
  prior: Map<string, string | null>
  inputTokens: number
  outputTokens: number
  steps: number
}

/**
 * Run the task as a tool-using agent: the model repeatedly calls tools (read/edit/write/run) that
 * mutate the container directly, until it calls `finish` or a budget is hit. This replaces the
 * one-shot generate-then-apply pipeline for the whole task.
 */
export async function runAgentLoop(args: {
  envId: string
  prompt: string
  memory: string | null
  /** Progress line per tool call (e.g. "Editing src/App.tsx"). */
  onActivity?: (msg: string) => void | Promise<void>
  /** Live assistant text (per step) → Task.streamContent. */
  onStream?: (text: string) => void
  assertNotCancelled?: () => Promise<void>
}): Promise<AgentLoopResult> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${AGENT_SYSTEM}${args.memory ? `\n\n${args.memory}` : ''}` },
    { role: 'user', content: args.prompt },
  ]

  const prior = new Map<string, string | null>()
  const touched = new Set<string>()
  let inputTokens = 0
  let outputTokens = 0
  let summary = 'Completed the requested change.'
  const deadline = Date.now() + ORCHESTRATION.MAX_TASK_MS

  let step = 0
  for (; step < ORCHESTRATION.AGENT_MAX_STEPS; step++) {
    if (Date.now() > deadline) break
    await args.assertNotCancelled?.()

    const resp = await chatWithTools(
      { model: MODELS.GENERATE, max_tokens: ORCHESTRATION.AGENT_MAX_OUTPUT, messages, tools: AGENT_TOOLS },
      { timeout: 120_000, maxRetries: 1 },
    )
    inputTokens += resp.inputTokens
    outputTokens += resp.outputTokens
    if (resp.content.trim()) args.onStream?.(resp.content)

    // Record the assistant turn (content may be null when it's purely tool calls — that is valid).
    messages.push({
      role: 'assistant',
      content: resp.content || null,
      ...(resp.toolCalls.length > 0
        ? {
            tool_calls: resp.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          }
        : {}),
    })

    // No tool calls → the model is done talking. Use its text as the summary and stop.
    if (resp.toolCalls.length === 0) {
      if (resp.content.trim()) summary = resp.content.trim().split('\n')[0]!.slice(0, 200)
      break
    }

    // Execute every tool call and reply with a matching tool message for each id (required by the API).
    let finished = false
    for (const tc of resp.toolCalls) {
      await args.onActivity?.(toolActivityLabel(tc.name, tc.arguments))
      const out = await executeAgentTool(args.envId, tc.name, tc.arguments)
      if (out.touched) {
        touched.add(out.touched)
        if (!prior.has(out.touched)) prior.set(out.touched, out.prior ?? null)
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: out.result })
      if (out.done) {
        finished = true
        if (out.summary) summary = out.summary
      }
    }
    if (finished) break
  }

  return {
    summary,
    touched: [...touched],
    prior,
    inputTokens,
    outputTokens,
    steps: step + 1,
  }
}
