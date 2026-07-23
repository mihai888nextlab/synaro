import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import { parseChangesResponse } from './parse-changes.js'
import type { FileChange, Plan } from './types.js'

const INTEGRATOR_SYSTEM = `You are the integrator on a team of parallel AI workers. Each worker built its own files without seeing the others. Your job is to WIRE THEM TOGETHER so the app works end-to-end.

Return ONLY valid JSON: { "changes": [ { "path": "relative/path", "content": "FULL file content" } ] }

Rules:
- Emit ONLY the glue needed: fix/add imports, register routes, mount components, update entry points (index/app/router), and add missing dependencies to package.json.
- Do NOT rewrite the workers' feature code. Prefer editing entry points and config over rewriting modules.
- Return FULL file content for any file you change. If nothing needs wiring, return { "changes": [] }.
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
 */
export async function integrate(
  envId: string,
  prompt: string,
  plan: Plan,
  changedPaths: string[],
  allPaths: string[],
): Promise<{ changes: FileChange[]; inputTokens: number; outputTokens: number }> {
  const readSet = Array.from(
    new Set([...changedPaths, ...ENTRY_CANDIDATES.filter((p) => allPaths.includes(p))]),
  )
  const files = await readWorkspaceFilesParallel(envId, readSet)
  const filesSection = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')

  const userPrompt = [
    `Task: ${prompt}`,
    `Plan: ${plan.summary}`,
    '',
    'Files created/modified by the workers this task:',
    changedPaths.map((p) => `- ${p}`).join('\n'),
    '',
    'All files currently in the project:',
    allPaths.join('\n'),
    '',
    'Relevant file contents:',
    filesSection || '(none)',
  ].join('\n')

  const response = await kimi.chat.completions.create({
    model: MODELS.GENERATE,
    max_tokens: ORCHESTRATION.WORKER_MAX_OUTPUT,
    messages: [
      { role: 'system', content: INTEGRATOR_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{"changes":[]}'
  let changes: FileChange[] = []
  try {
    changes = parseChangesResponse(raw).changes
  } catch {
    // Integrator returned malformed JSON — treat as "no wiring needed" rather than failing the task.
    changes = []
  }

  return {
    changes,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
