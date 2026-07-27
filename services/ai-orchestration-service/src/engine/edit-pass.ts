import { streamChat, MODELS } from '../lib/kimi.js'
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

function extractEdits(parsed: { edits?: unknown }): EditSpec[] {
  return Array.isArray(parsed.edits)
    ? (parsed.edits as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .filter(
          (r) => typeof r.path === 'string' && typeof r.search === 'string' && typeof r.replace === 'string',
        )
        .map((r) => ({ path: (r.path as string).trim(), search: r.search as string, replace: r.replace as string }))
    : []
}

function extractNewFiles(parsed: { newFiles?: unknown }): FileChange[] {
  return Array.isArray(parsed.newFiles)
    ? (parsed.newFiles as unknown[])
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r))
        .filter((r) => typeof r.path === 'string' && (r.path as string).trim() && typeof r.content === 'string')
        .map((r) => ({ path: (r.path as string).trim(), content: r.content as string }))
    : []
}

/**
 * Apply one search/replace. Tries an exact substring match first, then a line-based match that
 * tolerates the near-misses models actually make — CRLF vs LF and trailing whitespace — as long as
 * the match is UNIQUE. Anything looser (leading-indent changes, ambiguous matches) returns null so
 * we never silently apply an edit to the wrong place.
 */
function applySearchReplace(content: string, search: string, replace: string): string | null {
  const idx = content.indexOf(search)
  if (idx !== -1) {
    return content.slice(0, idx) + replace + content.slice(idx + search.length)
  }

  const fileLines = content.replace(/\r\n/g, '\n').split('\n')
  let searchLines = search.replace(/\r\n/g, '\n').split('\n')
  // A snippet copied "up to and including a newline" ends in an empty element — drop it so the
  // remaining lines can match mid-file.
  if (searchLines.length > 1 && searchLines[searchLines.length - 1] === '') searchLines = searchLines.slice(0, -1)
  if (searchLines.length === 0) return null

  const norm = (l: string) => l.replace(/[ \t]+$/g, '')
  const target = searchLines.map(norm)
  const matches: number[] = []
  for (let i = 0; i + target.length <= fileLines.length; i++) {
    let ok = true
    for (let j = 0; j < target.length; j++) {
      if (norm(fileLines[i + j]!) !== target[j]) {
        ok = false
        break
      }
    }
    if (ok) {
      matches.push(i)
      if (matches.length > 1) break // ambiguous — stop, we won't apply
    }
  }
  if (matches.length !== 1) return null

  const start = matches[0]!
  const replaceLines = replace.replace(/\r\n/g, '\n').split('\n')
  const result = [...fileLines.slice(0, start), ...replaceLines, ...fileLines.slice(start + target.length)]
  return result.join('\n')
}

/** Apply a list of edits over the read files. Returns the changed contents plus any edits that didn't match. */
function attemptApply(
  edits: EditSpec[],
  byPath: Map<string, string>,
): { updated: Map<string, string>; unmatched: EditSpec[] } {
  const updated = new Map<string, string>()
  const unmatched: EditSpec[] = []
  for (const e of edits) {
    const current = updated.get(e.path) ?? byPath.get(e.path)
    if (current === undefined) {
      unmatched.push(e) // editing a file we never read — can't verify, treat as a miss
      continue
    }
    const next = applySearchReplace(current, e.search, e.replace)
    if (next === null) {
      unmatched.push(e)
      continue
    }
    updated.set(e.path, next)
  }
  return { updated, unmatched }
}

/**
 * Fast targeted-edit pass for a small change: the model returns minimal search/replace snippets
 * instead of full files, so output is tiny and generation is quick. If some snippets don't match, it
 * does ONE corrective round-trip (feeding back the exact file text) — the same self-correction a
 * tool-using agent gets — before giving up. Returns null only when a clean edit still isn't possible
 * (no files, unparseable, or snippets that never matched), so the caller falls back to a full rewrite.
 */
export async function runEditPass(args: {
  envId: string
  prompt: string
  paths: string[]
  memory: string | null
  /** Live token stream (accumulated) — surfaced in the UI so the user sees the edit being produced. */
  onStream?: (accumulated: string) => void
}): Promise<{ changes: FileChange[]; inputTokens: number; outputTokens: number } | null> {
  const concrete = args.paths.filter((p) => !p.includes('*') && /\.[a-z0-9]+$/i.test(p))
  const files = await readWorkspaceFilesParallel(args.envId, concrete)
  if (files.length === 0) return null

  const byPath = new Map(files.map((f) => [f.path, f.content]))
  const filesSection = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')

  let inputTokens = 0
  let outputTokens = 0

  // ── Round 1: ask for the edit ────────────────────────────────────────────────────────────────
  let parsed: { edits?: unknown; newFiles?: unknown } | null
  try {
    const r = await streamChat(
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
      (acc) => args.onStream?.(acc),
    )
    inputTokens += r.inputTokens
    outputTokens += r.outputTokens
    parsed = parseEditJson(r.content)
  } catch {
    return null
  }
  if (!parsed) return null

  const edits = extractEdits(parsed)
  let newFiles = extractNewFiles(parsed)
  if (edits.length === 0 && newFiles.length === 0) return null

  let { updated, unmatched } = attemptApply(edits, byPath)

  // ── Round 2 (only if needed): feed back the snippets that didn't match and ask for corrections ──
  if (unmatched.length > 0) {
    // Keep the round-1 edits that DID match; we only re-issue the ones that missed.
    const round1Unmatched = unmatched
    const matchedEdits = edits.filter((e) => !round1Unmatched.includes(e))
    // Show the model only the files involved in the misses — keeps the correction prompt small/fast.
    const involved = new Set(unmatched.map((e) => e.path))
    const involvedSection = files
      .filter((f) => involved.has(f.path))
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n')
    const missList = unmatched
      .map(
        (e, i) =>
          `(${i + 1}) path: ${e.path}\n--- the "search" you gave (it was NOT found verbatim) ---\n${e.search}`,
      )
      .join('\n\n')

    try {
      const r2 = await streamChat(
        {
          model: MODELS.GENERATE,
          max_tokens: 4_000,
          messages: [
            { role: 'system', content: EDIT_SYSTEM },
            {
              role: 'user',
              content:
                `Some of your "search" snippets did not match the file, so the edit could not be applied. ` +
                `Copy "search" VERBATIM from the current file text below (exact characters and indentation), ` +
                `and return the COMPLETE corrected JSON for these edits.\n\n` +
                `Task: ${args.prompt}\n\nEdits that failed to match:\n\n${missList}\n\nCurrent files:\n\n${involvedSection}`,
            },
          ],
        },
        { timeout: 120_000, maxRetries: 1 },
        (acc) => args.onStream?.(acc),
      )
      inputTokens += r2.inputTokens
      outputTokens += r2.outputTokens
      const parsed2 = parseEditJson(r2.content)
      if (!parsed2) return null
      const corrected = extractEdits(parsed2)
      if (corrected.length === 0) return null
      // Re-apply the full set (matched round-1 edits + corrected ones) in order, from the original
      // files, so nothing that already applied is lost and same-file sequencing stays correct.
      ;({ updated, unmatched } = attemptApply([...matchedEdits, ...corrected], byPath))
      // The correction may also introduce new files — prefer them if present.
      const newFiles2 = extractNewFiles(parsed2)
      if (newFiles2.length > 0) newFiles = newFiles2
    } catch {
      return null
    }

    if (unmatched.length > 0) return null // still can't match cleanly — fall back to a full rewrite
  }

  const changes: FileChange[] = [
    ...Array.from(updated.entries()).map(([path, content]) => ({ path, content })),
    ...newFiles,
  ]
  if (changes.length === 0) return null

  return { changes, inputTokens, outputTokens }
}
