import OpenAI from 'openai'

// Kimi API is OpenAI-compatible so we use the openai SDK
export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
})

export const MODELS = {
  // Fast model for file analysis (repo scanning, relevance filtering)
  ANALYZE: 'moonshot-v1-8k',
  // Capable model for code generation
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
