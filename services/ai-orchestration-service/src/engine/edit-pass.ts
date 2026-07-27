import { kimi, MODELS } from '../lib/kimi.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import type { FileChange } from './types.js'

const EDIT_SYSTEM = `You are editing an EXISTING project. Make the SMALLEST change that satisfies the request. Do NOT rewrite whole files.

Return ONLY valid JSON:
{ "edits": [ { "path": "relative/path", "search": "exact snippet from the current file", "replace": "replacement snippet" } ], "newFiles": [ { "path": "relative/path", "content": "FULL file content" } ] }

Rules:
- "search" MUST be an exact, verbatim substring of the current file shown to you — copy it character-for-character including indentation, and include enough surrounding lines to be UNIQUE within that file.
- "replace" is what "search" becomes. Keep both as small as possible.
- Use "newFiles" ONLY for files that do not exist yet (full content).
- Do not modify files you were not asked to change.
- Return ONLY the JSON, no prose.`

interface EditSpec {
  path: string
  search: string
  replace: string
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : null
}

function parseEditJson(raw: string): { edits?: unknown; newFiles?: unknown } | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned) as { edits?: unknown; newFiles?: unknown }
  } catch {
    const s = cleaned.indexOf('{')
    const e = cleaned.lastIndexOf('}')
    if (s === -1 || e <= s) return null
    try {
      return JSON.parse(cleaned.slice(s, e + 1)) as { edits?: unknown; newFiles?: unknown }
    } catch {
      return null
    }
  }
}

/**
 * Fast targeted-edit pass for a small change: the model returns minimal search/replace snippets
 * instead of full files, so output is tiny and generation is quick. Returns null when a clean edit
 * isn't possible (no files to read, unparseable, or a `search` that doesn't match) — the caller then
 * falls back to a full-file rewrite so correctness is never sacrificed for speed.
 */
export async function runEditPass(args: {
  envId: string
  prompt: string
  paths: string[]
  memory: string | null
}): Promise<{ changes: FileChange[]; inputTokens: number; outputTokens: number } | null> {
  const concrete = args.paths.filter((p) => !p.includes('*') && /\.[a-z0-9]+$/i.test(p))
  const files = await readWorkspaceFilesParallel(args.envId, concrete)
  if (files.length === 0) return null

  const byPath = new Map(files.map((f) => [f.path, f.content]))
  const filesSection = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')

  let resp
  try {
    resp = await kimi.chat.completions.create(
      {
        model: MODELS.GENERATE,
        max_tokens: 4_000,
        messages: [
          { role: 'system', content: EDIT_SYSTEM },
          {
            role: 'user',
            content: `${args.memory ? `Context — ${args.memory}\n\n` : ''}Task: ${args.prompt}\n\nCurrent files:\n\n${filesSection}`,
          },
        ],
      },
      { timeout: 120_000, maxRetries: 1 },
    )
  } catch {
    return null
  }

  const parsed = parseEditJson(resp.choices[0]?.message?.content ?? '')
  if (!parsed) return null

  const edits: EditSpec[] = Array.isArray(parsed.edits)
    ? (parsed.edits as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .filter(
          (r) =>
            typeof r.path === 'string' && typeof r.search === 'string' && typeof r.replace === 'string',
        )
        .map((r) => ({ path: (r.path as string).trim(), search: r.search as string, replace: r.replace as string }))
    : []

  const newFiles: FileChange[] = Array.isArray(parsed.newFiles)
    ? (parsed.newFiles as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .filter((r) => typeof r.path === 'string' && (r.path as string).trim() && typeof r.content === 'string')
        .map((r) => ({ path: (r.path as string).trim(), content: r.content as string }))
    : []

  if (edits.length === 0 && newFiles.length === 0) return null

  // Apply edits in memory. Any unmatched `search` → bail so the caller does a full-file rewrite.
  const updated = new Map<string, string>()
  for (const e of edits) {
    const current = updated.get(e.path) ?? byPath.get(e.path)
    if (current === undefined) return null // editing an unread file — unsafe, fall back
    const idx = current.indexOf(e.search)
    if (idx === -1) return null // snippet didn't match verbatim — fall back for correctness
    updated.set(e.path, current.slice(0, idx) + e.replace + current.slice(idx + e.search.length))
  }

  const changes: FileChange[] = [
    ...Array.from(updated.entries()).map(([path, content]) => ({ path, content })),
    ...newFiles,
  ]
  if (changes.length === 0) return null

  return {
    changes,
    inputTokens: resp.usage?.prompt_tokens ?? 0,
    outputTokens: resp.usage?.completion_tokens ?? 0,
  }
}
