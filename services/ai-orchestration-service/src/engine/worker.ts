import { streamChat, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import { parseChangesResponse } from './parse-changes.js'
import { isOwned } from './ownership.js'
import { DESIGN_GUIDE } from './design-guide.js'
import type { FileChange, WorkerOutput, WorkerSpec } from './types.js'

const WORKER_SYSTEM = `You are an expert software engineer working as one member of a parallel team. You are responsible ONLY for the files assigned to you.

Return ONLY valid JSON in this exact shape:
{ "changes": [ { "path": "relative/path", "content": "FULL file content" } ] }

Rules:
- Only create/modify files within your assigned ownership. Do NOT touch files owned by other workers.
- Always return the FULL file content for every changed/created file (never null, never a diff).
- Other workers are building the rest of the app in parallel — you will not see their files. Do your part well; a separate integration step wires everything together afterward.
- For Next.js: never set distDir in next.config.*; never use output: 'export' or 'standalone'; include a "next dev" script; the app must bind to process.env.PORT (default 3000).
- When your files are UI (markup, components, or styles), hold them to the design bar below.
- Return ONLY the JSON, no prose.

${DESIGN_GUIDE}`

/** Read the concrete files a worker needs for context (globs/prefixes are skipped). */
function concretePaths(paths: string[]): string[] {
  return paths.filter((p) => !p.includes('*') && /\.[a-z0-9]+$/i.test(p))
}

async function generateScopedChanges(args: {
  envId: string
  role: string
  systemPrompt: string
  userPrompt: string
  readPaths: string[]
  ownedFiles: string[]
  /** Live token stream (accumulated across continuations) for the UI. */
  onStream?: (accumulated: string) => void
}): Promise<WorkerOutput> {
  const files = await readWorkspaceFilesParallel(args.envId, concretePaths(args.readPaths))
  const filesSection =
    files.length > 0
      ? files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : '(no existing files to read)'

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: args.systemPrompt },
    { role: 'user', content: `${args.userPrompt}\n\nRelevant files:\n\n${filesSection}` },
  ]

  // Accumulate across continuations. When a response is cut off at the token cap we ask the model
  // to resume exactly where it stopped and concatenate, rather than throwing away the whole task
  // (which previously forced a full 40-minute rerun). The pieces join into one valid JSON payload.
  let accumulated = ''
  let inputTokens = 0
  let outputTokens = 0
  let finishReason: string | null | undefined

  for (let attempt = 0; attempt <= ORCHESTRATION.MAX_CONTINUATIONS; attempt++) {
    // Report the running total (already-accumulated pieces + the current stream) so the UI shows a
    // single continuous output even across continuation requests.
    const prior = accumulated
    const response = await streamChat(
      { model: MODELS.GENERATE, max_tokens: ORCHESTRATION.WORKER_MAX_OUTPUT, messages },
      undefined,
      (acc) => args.onStream?.(prior + acc),
    )

    const piece = response.content
    finishReason = response.finishReason
    accumulated += piece
    inputTokens += response.inputTokens
    outputTokens += response.outputTokens

    if (finishReason !== 'length') break

    // Length-capped but EMPTY content: there's nothing to continue from, and feeding an empty
    // assistant turn back makes the next request 400 ("message at position N with role 'assistant'
    // must not be empty"). Stop here and let the parse below surface a clear error.
    if (!piece.trim()) break

    // Cut off at the cap — feed the partial back and ask it to continue seamlessly.
    messages.push({ role: 'assistant', content: piece })
    messages.push({
      role: 'user',
      content:
        'Your previous message was cut off at the token limit. Continue the JSON EXACTLY where you ' +
        'stopped — output only the remaining characters, no repetition, no restart, no code fences.',
    })
  }

  if (!accumulated.trim()) {
    throw new Error(`Worker "${args.role}" got an empty response from the model — retrying usually fixes it.`)
  }

  let changes: FileChange[]
  try {
    changes = parseChangesResponse(accumulated).changes
  } catch (err) {
    // Still truncated/unparseable after continuations. Surface a clear, actionable error instead of
    // a raw JSON-parse failure — but only after having genuinely tried to complete the response.
    if (finishReason === 'length') {
      throw new Error(
        `Worker "${args.role}" response was still cut off after ${ORCHESTRATION.MAX_CONTINUATIONS} ` +
          `continuation(s) — its slice is too large. Try a more specific prompt or split the request.`,
      )
    }
    throw err
  }

  // Keep the worker in its lane. If ownership filtering would drop everything (planner
  // mis-specified), keep the changes anyway — merge-time dedupe still prevents collisions.
  const owned = changes.filter((c) => isOwned(c.path, args.ownedFiles))
  const kept: FileChange[] = owned.length > 0 ? owned : changes

  return {
    role: args.role,
    changes: kept,
    inputTokens,
    outputTokens,
  }
}

/** Run one role-worker over its owned files. */
export async function runWorker(
  envId: string,
  worker: WorkerSpec,
  prompt: string,
  memory: string | null,
  onStream?: (accumulated: string) => void,
): Promise<WorkerOutput> {
  const ownership =
    worker.ownedFiles.length > 0
      ? `Your assigned files (create/modify only these):\n${worker.ownedFiles.map((f) => `- ${f}`).join('\n')}`
      : 'You own the whole task (no partition).'

  const userPrompt = [
    memory ? `Context — ${memory}\n` : '',
    `Overall task: ${prompt}`,
    '',
    `Your role: ${worker.role}`,
    `Your goal: ${worker.goal}`,
    '',
    ownership,
  ].join('\n')

  return generateScopedChanges({
    envId,
    role: worker.role,
    systemPrompt: WORKER_SYSTEM,
    userPrompt,
    readPaths: [...worker.filesToRead, ...worker.ownedFiles],
    ownedFiles: worker.ownedFiles,
    onStream,
  })
}

/**
 * Run all of a plan's workers with bounded concurrency. Each worker owns disjoint files, so
 * results can be merged safely. Failures are isolated — one worker throwing doesn't sink the rest.
 */
export async function runWorkersInParallel(
  envId: string,
  workers: WorkerSpec[],
  prompt: string,
  memory: string | null,
  onProgress?: (msg: string) => void | Promise<void>,
): Promise<WorkerOutput[]> {
  const results: WorkerOutput[] = []
  let index = 0
  let done = 0

  async function pump() {
    while (index < workers.length) {
      const w = workers[index++]!
      try {
        const out = await runWorker(envId, w, prompt, memory)
        results.push(out)
      } catch {
        // A single failed worker shouldn't fail the whole task; it just contributes no changes.
        results.push({ role: w.role, changes: [], inputTokens: 0, outputTokens: 0 })
      }
      done += 1
      await onProgress?.(`Workers finished ${done}/${workers.length}…`)
    }
  }

  const lanes = Array.from({ length: Math.min(ORCHESTRATION.WORKER_CONCURRENCY, workers.length) }, () =>
    pump(),
  )
  await Promise.all(lanes)
  return results
}

const FIXER_SYSTEM = `You are a senior engineer fixing a broken app. The dev server failed to run cleanly. Given the error output and the current files, return the MINIMAL set of file changes that make the app start and serve requests.

Return ONLY valid JSON: { "changes": [ { "path": "relative/path", "content": "FULL file content" } ] }

Rules:
- Change only what's needed to fix the failure (missing imports, wrong paths, syntax errors, bad config, port binding, missing deps in package.json).
- Return FULL file content for each changed file.
- For Next.js: never set distDir; include a "next dev" script; bind to process.env.PORT.
- Return ONLY the JSON.`

/**
 * Self-heal pass: given the health failure and the files touched so far, produce corrective changes.
 */
export async function runFixPass(
  envId: string,
  prompt: string,
  failure: { error: string; log: string },
  changedPaths: string[],
): Promise<WorkerOutput> {
  const userPrompt = [
    `Original task: ${prompt}`,
    '',
    'The app failed its health check.',
    `Failure: ${failure.error}`,
    '',
    'Dev-server log (tail):',
    '```',
    failure.log.slice(-4000),
    '```',
    '',
    'Files changed in this task (most likely to contain the problem):',
    changedPaths.map((p) => `- ${p}`).join('\n') || '(none listed)',
  ].join('\n')

  return generateScopedChanges({
    envId,
    role: 'fixer',
    systemPrompt: FIXER_SYSTEM,
    userPrompt,
    // Let the fixer read the files it changed plus common entry points.
    readPaths: [
      ...changedPaths,
      'package.json',
      'next.config.js',
      'next.config.mjs',
      'index.js',
      'index.ts',
      'src/index.ts',
      'app.js',
    ],
    ownedFiles: [], // unrestricted — fixes may touch any implicated file
  })
}
