import OpenAI from 'openai'

export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
})

export const MODEL = 'kimi-k2.7-code'

/** Models an agent is allowed to select. Anything else falls back to the default. */
export const ALLOWED_MODELS = ['kimi-k2.7-code', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] as const

export function resolveModel(model: string | null | undefined): string {
  return model && (ALLOWED_MODELS as readonly string[]).includes(model) ? model : MODEL
}
