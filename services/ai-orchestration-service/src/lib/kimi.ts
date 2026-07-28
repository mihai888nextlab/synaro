import OpenAI from 'openai'

// Kimi API is OpenAI-compatible so we use the openai SDK.
// A bounded per-request timeout + a single retry stops a slow/hung generation from silently
// eating the SDK default (10 min × 2 retries ≈ 30 min) with no progress shown to the user.
export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
  timeout: 300_000, // 5 min — generous for a full 16k-token generation, but not unbounded
  maxRetries: 1,
})

export type StreamChatResult = {
  content: string
  inputTokens: number
  outputTokens: number
  finishReason: string | null
}

/**
 * Streaming chat completion. Invokes `onText` with the ACCUMULATED content as tokens arrive, so
 * callers can surface a live view of exactly what the model is producing (piped into Task.streamContent
 * → shown in the chat UI). Returns the full content and token usage. Errors propagate to the caller,
 * which decides how to recover (e.g. edit-pass falls back to a full rewrite).
 */
/** If no token arrives for this long the stream is considered stalled and is aborted. */
const STREAM_IDLE_TIMEOUT_MS = 60_000

export async function streamChat(
  params: { model: string; max_tokens?: number; messages: OpenAI.Chat.ChatCompletionMessageParam[] },
  requestOpts: { timeout?: number; maxRetries?: number } | undefined,
  onText: (accumulated: string) => void,
): Promise<StreamChatResult> {
  // The SDK `timeout` only bounds the initial connection, NOT gaps BETWEEN streamed chunks — a stall
  // mid-stream would otherwise hang forever. This watchdog aborts if no chunk arrives for a while.
  const controller = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(
      () => controller.abort(new Error(`stream stalled: no data for ${STREAM_IDLE_TIMEOUT_MS / 1000}s`)),
      STREAM_IDLE_TIMEOUT_MS,
    )
  }

  let content = ''
  let finishReason: string | null = null
  let inputTokens = 0
  let outputTokens = 0

  try {
    armIdle()
    const stream = await kimi.chat.completions.create(
      {
        model: params.model,
        max_tokens: params.max_tokens,
        messages: params.messages,
        stream: true,
        stream_options: { include_usage: true },
      },
      { ...requestOpts, signal: controller.signal },
    )

    for await (const chunk of stream) {
      armIdle() // a chunk arrived — reset the stall watchdog
      const choice = chunk.choices[0]
      const delta = choice?.delta?.content
      if (typeof delta === 'string' && delta.length > 0) {
        content += delta
        onText(content)
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason
      // Usage arrives on the final chunk when stream_options.include_usage is set.
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens
        outputTokens = chunk.usage.completion_tokens ?? outputTokens
      }
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
  }

  return { content, inputTokens, outputTokens, finishReason }
}

export type AgentToolCall = { id: string; name: string; arguments: string }

export type ChatWithToolsResult = {
  content: string
  toolCalls: AgentToolCall[]
  inputTokens: number
  outputTokens: number
  finishReason: string | null
}

/**
 * One non-streaming step of a tool-using agent: the model sees the running message history + the tool
 * schemas and replies with assistant text and/or tool calls. Kept non-streaming so tool-call arguments
 * arrive whole (streamed tool_calls come fragmented and must be reassembled — a later refinement).
 */
export async function chatWithTools(
  params: {
    model: string
    max_tokens?: number
    messages: OpenAI.Chat.ChatCompletionMessageParam[]
    tools: OpenAI.Chat.ChatCompletionTool[]
  },
  requestOpts: { timeout?: number; maxRetries?: number } | undefined,
): Promise<ChatWithToolsResult> {
  const resp = await kimi.chat.completions.create(
    {
      model: params.model,
      max_tokens: params.max_tokens,
      messages: params.messages,
      tools: params.tools,
      tool_choice: 'auto',
      stream: false,
    },
    requestOpts,
  )
  const msg = resp.choices[0]?.message
  const toolCalls: AgentToolCall[] = (msg?.tool_calls ?? [])
    .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall => tc.type === 'function')
    .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }))
  return {
    content: msg?.content ?? '',
    toolCalls,
    inputTokens: resp.usage?.prompt_tokens ?? 0,
    outputTokens: resp.usage?.completion_tokens ?? 0,
    finishReason: resp.choices[0]?.finish_reason ?? null,
  }
}

export const MODELS = {
  // Fast model for file analysis (repo scanning, relevance filtering)
  ANALYZE: 'moonshot-v1-8k',
  // Fast model for planning / ownership partitioning (cheap triage)
  PLAN: 'moonshot-v1-8k',
  // Capable model for code generation (workers, integrator, fix passes)
  GENERATE: 'kimi-k2.6',
} as const

export const TOKEN_BUDGETS = {
  // Enough to hold a large repo tree + task description
  ANALYZE_MAX_INPUT: 16_000,
  // Enough to hold many source files as context
  GENERATE_MAX_INPUT: 100_000,
  // 32k tokens ≈ ~2400 lines of code — enough for a full multi-file project
  MAX_OUTPUT: 32_000,
} as const

// Multi-agent orchestration tuning (planner → parallel workers → integrator → health loop).
export const ORCHESTRATION = {
  /** Max role-workers a plan may spawn. */
  MAX_WORKERS: 4,
  /** How many workers run concurrently (bounds Kimi API pressure). */
  WORKER_CONCURRENCY: 3,
  /** Per-worker output budget (each owns a slice of the app, so smaller than a full-app pass). */
  WORKER_MAX_OUTPUT: 16_000,
  /** Integrator emits only glue edits to entry/config files — a much smaller budget than a worker. */
  INTEGRATOR_MAX_OUTPUT: 6_000,
  /** Per-request timeout for the integrator. It fails soft (skips wiring), so keep it short. */
  INTEGRATOR_TIMEOUT_MS: 90_000,
  /** Longest slice of a worker file shown to the integrator (imports/exports/signatures only). */
  INTEGRATOR_PREVIEW_CHARS: 1_400,
  /** Cap how many worker-file previews the integrator context includes. */
  INTEGRATOR_MAX_PREVIEW_FILES: 40,
  /** Self-heal attempts before giving up (complex, multi-worker tasks). */
  MAX_HEALTH_ITERATIONS: 3,
  /** Self-heal attempts for a simple single-edit task — one corrective pass is plenty. */
  SIMPLE_MAX_HEALTH_ITERATIONS: 1,
  /** How many recent tasks to replay as memory. */
  MEMORY_TASKS: 5,
  // ── File-by-file generation (robust replacement for parallel full-file workers) ──
  /** Max files a manifest may contain (bounds cost for a whole-app build). */
  MAX_FILES: 40,
  /** How many files are generated concurrently. Tier1 allows concurrency 50 / 200 RPM, so 5 is safe
   *  and much faster than the Tier0-era value of 2 — still far under the account's limits. */
  FILE_CONCURRENCY: 5,
  /** Output budget for a single file — one file is far smaller than a whole worker slice. */
  FILE_MAX_OUTPUT: 8_000,
  /** Per-file request timeout. Fails that one file (then retried), never the whole task. */
  FILE_TIMEOUT_MS: 90_000,
  /** Extra attempts for a file that came back empty/invalid/cut-off/rate-limited before giving up. */
  FILE_MAX_RETRIES: 3,
  /**
   * Overall wall-clock budget for the code-generation phase. Once exceeded, the self-heal loop
   * stops and the task returns whatever it has (with a health note) rather than grinding for
   * tens of minutes. Model calls are separately bounded by the client `timeout` above.
   */
  MAX_TASK_MS: 12 * 60_000,
  /** Max times a worker will ask the model to continue when a response is cut off at the token cap. */
  MAX_CONTINUATIONS: 2,
  /** Agentic tool-loop: max model steps (tool round-trips) before the loop stops. */
  AGENT_MAX_STEPS: 24,
  /** Read-only exploration sub-agent: smaller budget, it only reads and reports. */
  AGENT_SUBAGENT_MAX_STEPS: 12,
  /** Agentic tool-loop: per-step model output budget (tool args can include full file contents). */
  AGENT_MAX_OUTPUT: 16_000,
} as const
