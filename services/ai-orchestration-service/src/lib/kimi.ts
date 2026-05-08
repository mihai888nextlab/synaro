import OpenAI from 'openai'

// Kimi API is OpenAI-compatible so we use the openai SDK
export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
})

export const MODELS = {
  // Cheap model for analysis (file selection, repo scanning)
  ANALYZE: 'moonshot-v1-8k',
  // Capable model for code generation
  GENERATE: 'kimi-k2.6',
} as const

export const TOKEN_BUDGETS = {
  ANALYZE_MAX_INPUT: 4_000,
  GENERATE_MAX_INPUT: 20_000,
  MAX_OUTPUT: 4_000,
} as const