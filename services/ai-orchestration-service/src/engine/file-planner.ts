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

  const response = await kimi.chat.completions.create({
    model: MODELS.GENERATE,
    max_tokens: 3_000,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { summary?: unknown; files?: unknown } = {}
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as typeof parsed
  } catch {
    parsed = {}
  }

  const files: FileSpec[] = Array.isArray(parsed.files)
    ? (parsed.files as unknown[])
        .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
        .map((f) => ({
          path: typeof f.path === 'string' ? f.path.trim() : '',
          purpose: typeof f.purpose === 'string' ? f.purpose.trim() : '',
        }))
        .filter((f) => f.path.length > 0)
        .slice(0, ORCHESTRATION.MAX_FILES)
    : []

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Build the requested project.',
    files,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
