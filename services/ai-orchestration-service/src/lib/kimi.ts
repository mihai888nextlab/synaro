import OpenAI from 'openai'

// Kimi API is OpenAI-compatible so we use the openai SDK
export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
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
  /** Self-heal attempts before giving up. */
  MAX_HEALTH_ITERATIONS: 3,
  /** How many recent tasks to replay as memory. */
  MEMORY_TASKS: 5,
} as const
