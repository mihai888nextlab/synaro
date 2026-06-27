const MAX_OUTPUT_BYTES = 50_000
const TIMEOUT_MS = 30_000

interface BraveResult {
  title?: string
  url?: string
  description?: string
}

interface BraveResponse {
  web?: { results?: BraveResult[] }
}

export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim()
  if (!apiKey) return 'Error: BRAVE_SEARCH_API_KEY is not configured'
  if (!query.trim()) return 'Error: query cannot be empty'

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      return `Error: Brave Search returned HTTP ${res.status}`
    }

    const data = (await res.json()) as BraveResponse
    const results = data?.web?.results ?? []

    if (results.length === 0) return 'No results found.'

    const formatted = results
      .slice(0, 5)
      .map((r, i) => `[${i + 1}] ${r.title ?? 'No title'}\nURL: ${r.url ?? ''}\n${r.description ?? ''}`)
      .join('\n\n')

    const output = `Search results for "${query}":\n\n${formatted}`
    return output.length > MAX_OUTPUT_BYTES ? output.slice(0, MAX_OUTPUT_BYTES) + '\n[truncated]' : output
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'Error: web search timed out'
    return `Error: ${String(err)}`
  } finally {
    clearTimeout(timer)
  }
}
