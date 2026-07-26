import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import { parseChangesResponse } from './parse-changes.js'
import type { FileChange, Plan } from './types.js'

const INTEGRATOR_SYSTEM = `You are the integrator on a team of parallel AI workers. Each worker built its own files without seeing the others. Your job is to WIRE THEM TOGETHER so the app works end-to-end.

Return ONLY valid JSON: { "changes": [ { "path": "relative/path", "content": "FULL file content" } ] }

Rules:
- Emit ONLY the glue needed: fix/add imports, register routes, mount components, update entry points (index/app/router), and add missing dependencies to package.json.
- You are given the FULL content of entry/config files (edit these) and short PREVIEWS of the worker files (imports/exports/signatures — for reference only). Do NOT rewrite worker files; wire them from the entry points.
- Only return changes for entry/config files. Return FULL file content for each file you change. If nothing needs wiring, return { "changes": [] }.
- For Next.js: never set distDir; ensure a "next dev" script exists; bind to process.env.PORT.
- Return ONLY the JSON.`

/** Common entry/config files worth reading so the integrator can wire things up. */
const ENTRY_CANDIDATES = [
  'package.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'index.js',
  'index.ts',
  'src/index.ts',
  'src/index.js',
  'app.js',
  'app.ts',
  'src/app.ts',
  'server.js',
  'src/main.ts',
  'src/main.tsx',
  'src/App.tsx',
  'pages/_app.tsx',
  'pages/index.tsx',
  'src/router.ts',
]

/**
 * Single wiring pass over the merged worker output. `changedPaths` is every path the workers
 * created/modified this task; `allPaths` is the full post-write file list.
 *
 * Deliberately kept lightweight: the integrator only edits entry/config files, so it gets those in
 * FULL but sees worker files only as short signature PREVIEWS. Sending the full body of every changed
 * file was the main reason this call ballooned and timed out. It also fails soft — any error (timeout,
 * bad JSON) returns "no wiring" so the task ships the worker output instead of dying here.
 */
export async function integrate(
  envId: string,
  prompt: string,
  plan: Plan,
  changedPaths: string[],
  allPaths: string[],
): Promise<{ changes: FileChange[]; inputTokens: number; outputTokens: number }> {
  const entryPaths = ENTRY_CANDIDATES.filter((p) => allPaths.includes(p))
  const entrySet = new Set(entryPaths)
  const previewPaths = changedPaths
    .filter((p) => !entrySet.has(p))
    .slice(0, ORCHESTRATION.INTEGRATOR_MAX_PREVIEW_FILES)

  // Read entry/config files (full) and worker files (truncated to signatures) in one batch.
  const files = await readWorkspaceFilesParallel(envId, [...entryPaths, ...previewPaths])
  const byPath = new Map(files.map((f) => [f.path, f.content]))

  const entrySection = entryPaths
    .filter((p) => byPath.has(p))
    .map((p) => `### ${p}\n\`\`\`\n${byPath.get(p)}\n\`\`\``)
    .join('\n\n')

  const previewSection = previewPaths
    .filter((p) => byPath.has(p))
    .map((p) => {
      const content = byPath.get(p) ?? ''
      const preview =
        content.length > ORCHESTRATION.INTEGRATOR_PREVIEW_CHARS
          ? `${content.slice(0, ORCHESTRATION.INTEGRATOR_PREVIEW_CHARS)}\n… (truncated)`
          : content
      return `### ${p}\n\`\`\`\n${preview}\n\`\`\``
    })
    .join('\n\n')

  const userPrompt = [
    `Task: ${prompt}`,
    `Plan: ${plan.summary}`,
    '',
    'Files created/modified by the workers this task:',
    changedPaths.map((p) => `- ${p}`).join('\n'),
    '',
    'Entry/config files — EDIT THESE to wire the app together (full content):',
    entrySection || '(none)',
    '',
    'Worker files — reference only, for their imports/exports (previews, do NOT rewrite):',
    previewSection || '(none)',
  ].join('\n')

  let response
  try {
    response = await kimi.chat.completions.create(
      {
        model: MODELS.GENERATE,
        max_tokens: ORCHESTRATION.INTEGRATOR_MAX_OUTPUT,
        messages: [
          { role: 'system', content: INTEGRATOR_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
      },
      { timeout: ORCHESTRATION.INTEGRATOR_TIMEOUT_MS, maxRetries: 0 },
    )
  } catch {
    // Timeout / network error — integration is best-effort glue. Skip it rather than fail the task.
    return { changes: [], inputTokens: 0, outputTokens: 0 }
  }

  const raw = response.choices[0]?.message?.content ?? '{"changes":[]}'
  let changes: FileChange[] = []
  try {
    changes = parseChangesResponse(raw).changes
  } catch {
    // Integrator returned malformed JSON — treat as "no wiring needed" rather than failing the task.
    changes = []
  }

  // Guard: the integrator should only touch entry/config files. Drop any attempt to rewrite a worker
  // file (keeps a stray full-file rewrite from clobbering good worker output).
  const allowed = new Set([...entryPaths])
  const glueOnly = changes.filter((c) => allowed.has(c.path) || !changedPaths.includes(c.path))

  return {
    changes: glueOnly,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
