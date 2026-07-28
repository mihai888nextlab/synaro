import type OpenAI from 'openai'
import { chatWithTools, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import {
  AGENT_TOOLS,
  EXPLORE_TOOLS,
  DELEGATE_TOOL,
  executeAgentTool,
  toolActivityLabel,
} from './agent-tools.js'
import { DESIGN_GUIDE } from './design-guide.js'

/** Off by default. When AGENT_SUBAGENTS=true the main agent can delegate read-only exploration. */
const SUBAGENTS_ENABLED = process.env.AGENT_SUBAGENTS === 'true'

/** Tools an exploration sub-agent is ever allowed to run (belt-and-suspenders read-only enforcement). */
const EXPLORE_TOOL_NAMES = new Set(['list_files', 'read_file', 'finish'])

const EXPLORE_SYSTEM = `You are a READ-ONLY exploration assistant. Another agent has asked you to investigate this project's code and report back.

- Use ONLY list_files and read_file. You CANNOT modify anything.
- Find what was asked: the relevant files, where the logic lives, key snippets, how things connect.
- Be efficient — batch reads, don't wander.
- When done, call finish with a CONCISE, actionable report (file paths + the specific facts/snippets the other agent needs). Do not dump whole files; summarize.`

/**
 * Read-only exploration sub-agent: runs its own small loop in a fresh context (list/read/finish only)
 * and returns a concise report. Isolating exploration here keeps the main agent's context lean.
 */
async function runExploreSubAgent(
  envId: string,
  instruction: string,
  onActivity?: (msg: string) => void | Promise<void>,
): Promise<{ report: string; inputTokens: number; outputTokens: number }> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: EXPLORE_SYSTEM },
    { role: 'user', content: instruction },
  ]
  let inputTokens = 0
  let outputTokens = 0
  let report = '(the sub-agent returned no findings)'
  const deadline = Date.now() + ORCHESTRATION.MAX_TASK_MS

  for (let step = 0; step < ORCHESTRATION.AGENT_SUBAGENT_MAX_STEPS; step++) {
    if (Date.now() > deadline) break
    pruneToolHistory(messages)
    let resp
    try {
      resp = await chatWithTools(
        { model: MODELS.GENERATE, max_tokens: ORCHESTRATION.AGENT_MAX_OUTPUT, messages, tools: EXPLORE_TOOLS },
        { timeout: 120_000, maxRetries: 0 },
      )
    } catch {
      break
    }
    inputTokens += resp.inputTokens
    outputTokens += resp.outputTokens
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
    if (resp.toolCalls.length === 0) {
      if (resp.content.trim()) report = resp.content.trim()
      break
    }
    let done = false
    for (const tc of resp.toolCalls) {
      await onActivity?.(`↳ ${toolActivityLabel(tc.name, tc.arguments)}`)
      // Hard read-only guard: refuse any tool outside the explore set, even if the model invents one.
      if (!EXPLORE_TOOL_NAMES.has(tc.name)) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `Error: "${tc.name}" is not available — you are READ-ONLY. Use list_files / read_file, then finish.`,
        })
        continue
      }
      const out = await executeAgentTool(envId, tc.name, tc.arguments)
      messages.push({ role: 'tool', tool_call_id: tc.id, content: out.result })
      if (out.done) {
        report = out.summary ?? report
        done = true
      }
    }
    if (done) break
  }
  return { report, inputTokens, outputTokens }
}

const AGENT_SYSTEM = `You are an autonomous coding agent working directly inside a project's live workspace using tools.

Work in a loop: inspect with list_files/read_file, change with edit_file/write_file, optionally verify with run_command, then call finish.

Rules:
- ALWAYS read a file with read_file before editing it, and copy the "search" text VERBATIM from what you read (exact characters and indentation).
- Make the SMALLEST change that satisfies the request. Prefer edit_file over rewriting whole files with write_file.
- Do NOT ask the user questions — the framework, language, and styling are already fixed (see context). Proceed with sensible defaults.
- For Next.js: never set distDir in next.config.*; never use output: 'export' or 'standalone'; keep a "next dev" script; the app must bind to process.env.PORT (default 3000).
- When your files are UI (markup, components, styles), hold them to the design bar below.
- GO FAST: batch independent tool calls into ONE step (e.g. read several files, or read + list, at once) instead of one per step — each step is a slow round-trip. Don't re-read files already shown to you.
- VERIFY before finishing: after any change that could break the app (editing code, not just copy/text), run a fast check with run_command — \`npx tsc --noEmit\` for a TypeScript project, otherwise \`npm run build\` — read the output, fix any errors, and re-check until it passes. Skip verification only for trivial content/copy edits.
- Be efficient — you have a limited number of steps. When the change is complete AND verified, call finish with a one-sentence summary. Do not call finish before the change is done.

${DESIGN_GUIDE}`

/**
 * Bound context growth: keep only the most recent tool outputs at full size and stub out older ones.
 * Later steps otherwise re-send every file read + command output, ballooning the prompt and slowing
 * (and eventually timing out) each call. The model can re-read anything it stubbed with read_file.
 */
/** Files a typecheck/build would validate — used to decide whether a verify step is warranted. */
const CODE_FILE_RE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|astro|py)$/i
/** A run_command that plausibly verifies the app (so we don't nag the model after it already checked). */
const VERIFY_CMD_RE = /\b(tsc|type-?check|build|test|lint|vitest|jest|pytest|eslint|check)\b/i

function commandArg(rawArgs: string): string {
  try {
    const v = JSON.parse(rawArgs || '{}') as { command?: unknown }
    return typeof v.command === 'string' ? v.command : ''
  } catch {
    return ''
  }
}

function pruneToolHistory(messages: OpenAI.Chat.ChatCompletionMessageParam[], keepLast = 8): void {
  const toolIdx: number[] = []
  for (let i = 0; i < messages.length; i++) if (messages[i]!.role === 'tool') toolIdx.push(i)
  const trimCount = toolIdx.length - keepLast
  for (let k = 0; k < trimCount; k++) {
    const m = messages[toolIdx[k]!] as { content?: unknown }
    if (typeof m.content === 'string' && m.content.length > 120) {
      m.content = '[earlier tool output trimmed to save context — re-read the file if you need it]'
    }
  }
}

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
  /** The workspace is empty/near-empty → scaffold a whole app, with a larger step budget. */
  newProject?: boolean
  /** Existing file paths, seeded into the opening message so the agent skips an initial list_files. */
  repoFiles?: string[]
  /** Progress line per tool call (e.g. "Editing src/App.tsx"). */
  onActivity?: (msg: string) => void | Promise<void>
  /** Live assistant text (per step) → Task.streamContent. */
  onStream?: (text: string) => void
  assertNotCancelled?: () => Promise<void>
}): Promise<AgentLoopResult> {
  const scaffoldNote = args.newProject
    ? '\n\nThe workspace is EMPTY — scaffold a COMPLETE, runnable project from scratch that MATCHES THE REQUEST. ' +
      'Use the language and kind the request implies: a Python script → a .py file (plus requirements.txt only if needed); ' +
      'a CLI/tool/script → the minimal single-language setup for it; a WEB APP or UI with no stack named → Next.js ' +
      '(Pages Router) + TypeScript + Tailwind. Do NOT create a package.json or a web/Next.js scaffold for a non-web ' +
      'request. Include whatever file makes it runnable, install dependencies only if the project needs them, and ' +
      'verify it runs before finishing.'
    : ''
  const maxSteps = args.newProject ? ORCHESTRATION.AGENT_MAX_STEPS * 2 : ORCHESTRATION.AGENT_MAX_STEPS
  // Seed the file list so the agent goes straight to read_file/edit_file instead of spending a
  // round-trip on list_files. Capped so a huge repo doesn't blow the prompt.
  const fileListNote =
    !args.newProject && args.repoFiles && args.repoFiles.length > 0
      ? `\n\nProject files (open any with read_file — no need to list_files first):\n${args.repoFiles
          .slice(0, 300)
          .join('\n')}${args.repoFiles.length > 300 ? '\n… (more — use list_files for the rest)' : ''}`
      : ''
  const delegateNote = SUBAGENTS_ENABLED
    ? '\n\nFor a large or unfamiliar codebase, you can call `delegate` to have a sub-agent investigate ' +
      '(read-only) and report back, instead of reading many files yourself.'
    : ''
  const tools = SUBAGENTS_ENABLED ? [...AGENT_TOOLS, DELEGATE_TOOL] : AGENT_TOOLS
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${AGENT_SYSTEM}${args.memory ? `\n\n${args.memory}` : ''}` },
    { role: 'user', content: `${args.prompt}${scaffoldNote}${fileListNote}${delegateNote}` },
  ]

  const prior = new Map<string, string | null>()
  const touched = new Set<string>()
  let inputTokens = 0
  let outputTokens = 0
  let summary = 'Completed the requested change.'
  // Self-verify backstop: block the first `finish` if a SUBSTANTIAL code change was never checked.
  // A single small edit to one existing file skips the forced check (prompt still nudges) — the
  // mandatory build is the biggest latency cost, so we only pay it when the risk warrants it.
  let codeEditedSinceVerify = false
  let verifyNudged = false
  const codeFilesTouched = new Set<string>()
  let createdCodeFile = false
  const deadline = Date.now() + ORCHESTRATION.MAX_TASK_MS

  let step = 0
  let stopNote = ''
  for (; step < maxSteps; step++) {
    if (Date.now() > deadline) {
      stopNote = ' (stopped early: hit the time budget)'
      break
    }
    await args.assertNotCancelled?.()
    pruneToolHistory(messages)

    let resp
    try {
      resp = await chatWithTools(
        { model: MODELS.GENERATE, max_tokens: ORCHESTRATION.AGENT_MAX_OUTPUT, messages, tools },
        // No SDK auto-retry: a retried timeout doubles the wait before failing. One slow step must not
        // kill the whole task — we catch below and keep whatever was already applied.
        { timeout: 180_000, maxRetries: 0 },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[agent-loop] step ${step} model call failed — ${msg}`)
      // Nothing applied yet → surface the real failure. Otherwise keep the partial work and stop.
      if (touched.size === 0) throw err
      stopNote = ` (stopped early after a model error: ${msg})`
      break
    }
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

      // Delegation: run a read-only exploration sub-agent and hand its concise report back as the
      // tool result. Kept out of executeAgentTool because it recurses into the loop machinery here.
      if (tc.name === 'delegate') {
        let report: string
        try {
          const d = JSON.parse(tc.arguments || '{}') as { instruction?: unknown }
          const instruction = typeof d.instruction === 'string' ? d.instruction.trim() : ''
          if (!instruction) {
            report = 'Error: delegate requires an "instruction".'
          } else {
            const sub = await runExploreSubAgent(args.envId, instruction, args.onActivity)
            inputTokens += sub.inputTokens
            outputTokens += sub.outputTokens
            report = sub.report
          }
        } catch (e) {
          report = `Delegation failed: ${e instanceof Error ? e.message : String(e)}`
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: report })
        continue
      }

      // Backstop: refuse the FIRST finish only when a SUBSTANTIAL code change (new file, multiple
      // files, or a greenfield build) was never verified. Single small edits rely on the prompt nudge.
      const substantial = Boolean(args.newProject) || createdCodeFile || codeFilesTouched.size >= 2
      if (tc.name === 'finish' && codeEditedSinceVerify && substantial && !verifyNudged) {
        verifyNudged = true
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content:
            'Not finishing yet: you changed code but have not verified it. Run a check with run_command ' +
            '(`npx tsc --noEmit`, or `npm run build`), fix any errors it reports, then call finish again.',
        })
        continue
      }

      const out = await executeAgentTool(args.envId, tc.name, tc.arguments)
      if (out.touched) {
        touched.add(out.touched)
        if (!prior.has(out.touched)) prior.set(out.touched, out.prior ?? null)
        if (CODE_FILE_RE.test(out.touched)) {
          codeEditedSinceVerify = true
          codeFilesTouched.add(out.touched)
          if (tc.name === 'write_file' && out.prior === null) createdCodeFile = true // brand-new code file
        }
      }
      if (tc.name === 'run_command' && VERIFY_CMD_RE.test(commandArg(tc.arguments))) {
        codeEditedSinceVerify = false // they ran a verification-like command
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
    summary: `${summary}${stopNote}`,
    touched: [...touched],
    prior,
    inputTokens,
    outputTokens,
    steps: step + 1,
  }
}
