import type { FileChange } from './types.js'

export interface ParsedChanges {
  summary: string | null
  changes: FileChange[]
}

/**
 * Parse a model response of the shape `{ summary?, changes: [{ path, content }] }`.
 * Tolerates markdown code fences around the JSON. Returns validated changes only
 * (path + content both non-empty strings); throws on unparseable JSON.
 */
export function parseChangesResponse(raw: string): ParsedChanges {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim()

  let parsed: { summary?: unknown; changes?: unknown }
  try {
    parsed = JSON.parse(cleaned || '{}') as typeof parsed
  } catch (e) {
    throw new Error(`AI returned invalid JSON — could not parse file changes. Parse error: ${String(e)}`)
  }

  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : []
  const changes: FileChange[] = rawChanges
    .filter(
      (c): c is { path: string; content: string } =>
        Boolean(c) &&
        typeof (c as { path?: unknown }).path === 'string' &&
        (c as { path: string }).path.trim().length > 0 &&
        typeof (c as { content?: unknown }).content === 'string',
    )
    .map((c) => ({ path: c.path.trim(), content: c.content }))

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    changes,
  }
}

/**
 * Merge changes from multiple sources, deduping by path. First writer wins — the ultimate guard
 * against two parallel workers (or a worker + integrator) targeting the same file.
 */
export function mergeChanges(changes: FileChange[]): FileChange[] {
  const byPath = new Map<string, FileChange>()
  for (const c of changes) {
    if (!byPath.has(c.path)) byPath.set(c.path, c)
  }
  return Array.from(byPath.values())
}
