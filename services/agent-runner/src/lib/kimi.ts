import OpenAI from 'openai'

export const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.ai/v1',
})

export const MODEL = 'kimi-k2.6'
