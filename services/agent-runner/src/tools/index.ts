import type OpenAI from 'openai'
import { webSearch } from './web-search.js'
import { httpGet, httpPost } from './http.js'

export const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Use this to look up facts, recent events, or anything you are unsure about.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_get',
      description: 'Fetch content from a public URL via HTTP GET.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The public URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_post',
      description: 'Send an HTTP POST request to a public URL with a JSON body.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The public URL to POST to' },
          body: { type: 'object', description: 'JSON body to send' },
          headers: { type: 'object', description: 'Optional additional headers' },
        },
        required: ['url', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Signal that you have completed the task. Call this when you have a final answer.',
      parameters: {
        type: 'object',
        properties: {
          answer: { type: 'string', description: 'The final answer or result to return to the user' },
        },
        required: ['answer'],
      },
    },
  },
]

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'web_search':
      return webSearch(String(args.query ?? ''))
    case 'http_get':
      return httpGet(String(args.url ?? ''))
    case 'http_post':
      return httpPost(String(args.url ?? ''), args.body as Record<string, unknown>, args.headers as Record<string, string> | undefined)
    case 'finish':
      return String(args.answer ?? '')
    default:
      return `Unknown tool: ${name}`
  }
}
