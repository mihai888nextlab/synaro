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
  /** Self-heal attempts before giving up (complex, multi-worker tasks). */
  MAX_HEALTH_ITERATIONS: 3,
  /** Self-heal attempts for a simple single-edit task — one corrective pass is plenty. */
  SIMPLE_MAX_HEALTH_ITERATIONS: 1,
  /** How many recent tasks to replay as memory. */
  MEMORY_TASKS: 5,
  /**
   * Overall wall-clock budget for the code-generation phase. Once exceeded, the self-heal loop
   * stops and the task returns whatever it has (with a health note) rather than grinding for
   * tens of minutes. Model calls are separately bounded by the client `timeout` above.
   */
  MAX_TASK_MS: 12 * 60_000,
  /** Max times a worker will ask the model to continue when a response is cut off at the token cap. */
  MAX_CONTINUATIONS: 2,
} as const
