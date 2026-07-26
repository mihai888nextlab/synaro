import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'

export interface FileSpec {
  path: string
  /** One line describing what the file contains and, ideally, what it exports. */
  purpose: string
}

export interface FileManifest {
  summary: string
  files: FileSpec[]
  inputTokens: number
  outputTokens: number
}

const PLANNER_SYSTEM = `You are the lead engineer planning a software project. Given a task and the current repository, produce a COMPLETE list of the files needed to fulfill the task, each with a one-line purpose.

Return ONLY valid JSON:
{ "summary": "one sentence describing what will be built", "files": [ { "path": "relative/path", "purpose": "what this file contains and what it exports" } ] }

Rules:
- List EVERY file needed end-to-end: entry points, config (package.json, next.config, tsconfig, etc.), source files, and styles. Do not leave an implied file out.
- Paths are relative to the project root. Use a conventional structure for the stack you choose.
- For a Node/Next.js app, include a package.json whose "dev" script starts a server that binds to process.env.PORT (default 3000). Never set distDir.
- Keep files small and single-purpose — split large modules into several files. Each "purpose" should name the file's key exports so other files can import them correctly.
- Return ONLY the JSON, no prose.`

/**
 * Plan the project as a flat list of files with purposes. This replaces role-worker planning: instead
 * of a few workers each emitting a giant multi-file blob, we get a manifest and generate each file on
 * its own (small, validated, retryable). The manifest also gives every per-file call global context.
 */
export async function planFiles(
  prompt: string,
  repoTree: string,
  memory: string | null,
): Promise<FileManifest> {
  const userPrompt = [
    memory ? `Context — ${memory}\n` : '',
    `Task: ${prompt}`,
    '',
    'Existing repository files:',
    repoTree || '(empty — new project)',
  ].join('\n')

  // Use the fast model (like triage/planner) — it emits clean JSON reliably, whereas the big code
  // model tends to wrap output in prose/reasoning that breaks strict parsing and yields zero files.
  const response = await kimi.chat.completions.create({
    model: MODELS.PLAN,
    max_tokens: 3_000,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  const parsed = extractManifestJson(raw)
  // Tolerate a bare array or an object with files/entries; and accept common key aliases per entry.
  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { files?: unknown })?.files)
      ? ((parsed as { files: unknown[] }).files)
      : []

  const files: FileSpec[] = rawList
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
    .map((f) => {
      const path =
        (typeof f.path === 'string' && f.path) ||
        (typeof f.file === 'string' && f.file) ||
        (typeof f.name === 'string' && f.name) ||
        (typeof f.filename === 'string' && f.filename) ||
        ''
      const purpose =
        (typeof f.purpose === 'string' && f.purpose) ||
        (typeof f.description === 'string' && f.description) ||
        (typeof f.summary === 'string' && f.summary) ||
        ''
      return { path: path.trim(), purpose: purpose.trim() }
    })
    .filter((f) => f.path.length > 0)
    .slice(0, ORCHESTRATION.MAX_FILES)

  if (files.length === 0) {
    console.warn(
      `[file-planner] no files parsed from manifest response. Raw (first 400 chars): ${raw.slice(0, 400)}`,
    )
  }

  const summaryVal =
    (!Array.isArray(parsed) && typeof (parsed as { summary?: unknown })?.summary === 'string'
      ? (parsed as { summary: string }).summary
      : null) ?? 'Build the requested project.'

  return {
    summary: summaryVal,
    files,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

/**
 * Best-effort JSON extraction from a model response. Handles fenced blocks and prose around the JSON
 * by falling back to the first `{…}` / `[…]` span, so a chatty model doesn't yield an empty manifest.
 */
function extractManifestJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  if (!cleaned) return {}
  try {
    return JSON.parse(cleaned)
  } catch {
    // Fall back to the widest brace/bracket span in the text.
    const start = cleaned.search(/[{[]/)
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return {}
      }
    }
    return {}
  }
}
