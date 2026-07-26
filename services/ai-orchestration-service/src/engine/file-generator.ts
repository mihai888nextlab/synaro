import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import type { FileChange } from './types.js'
import type { FileManifest, FileSpec } from './file-planner.js'

const FILE_SYSTEM = `You are an expert engineer generating ONE file of a larger project. You are given the overall task, the full file manifest (so you know what other files exist and can import them correctly), and the specific file to write.

Output ONLY the raw, complete contents of the file — no markdown code fences, no JSON wrapper, no commentary, no explanation. Just the file content exactly as it should be saved to disk.

Rules:
- Write the COMPLETE file. It must be syntactically valid and consistent with the manifest.
- Import from other project files using the exact paths in the manifest.
- For Next.js: never set distDir; ensure package.json has a "dev" script; bind to process.env.PORT (default 3000).`

/** Strip a stray markdown code fence the model may wrap the file in, despite instructions. */
function stripFences(raw: string): string {
  const s = raw.trim()
  const fenced = s.match(/^```[a-zA-Z0-9.+-]*\n([\s\S]*?)\n```$/)
  if (fenced?.[1] !== undefined) return fenced[1]
  return s.replace(/^```[a-zA-Z0-9.+-]*\n/, '').replace(/\n```$/, '')
}

/** Cheap validity gate: non-empty, and JSON files must parse. */
function isValidContent(spec: FileSpec, content: string): boolean {
  if (!content.trim()) return false
  if (spec.path.endsWith('.json')) {
    try {
      JSON.parse(content)
    } catch {
      return false
    }
  }
  return true
}

interface OneFileResult {
  ok: boolean
  content: string
  attempts: number
  inputTokens: number
  outputTokens: number
  /** Why the last attempt failed (for logging), or null on success. */
  reason: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function generateOneFile(
  spec: FileSpec,
  prompt: string,
  manifest: FileManifest,
  memory: string | null,
  existing: string | undefined,
): Promise<OneFileResult> {
  const manifestList = manifest.files.map((f) => `- ${f.path}: ${f.purpose}`).join('\n')
  const userPrompt = [
    memory ? `Context — ${memory}\n` : '',
    `Overall task: ${prompt}`,
    `Project: ${manifest.summary}`,
    '',
    'Full file manifest (all files in the project):',
    manifestList,
    '',
    existing
      ? `This file already exists — modify it as needed. Current content:\n\`\`\`\n${existing}\n\`\`\`\n`
      : '',
    `Now write this file: ${spec.path}`,
    `Purpose: ${spec.purpose}`,
  ].join('\n')

  let attempts = 0
  let inputTokens = 0
  let outputTokens = 0
  let reason: string | null = null

  for (let attempt = 0; attempt <= ORCHESTRATION.FILE_MAX_RETRIES; attempt++) {
    attempts += 1
    try {
      const resp = await kimi.chat.completions.create(
        {
          model: MODELS.GENERATE,
          max_tokens: ORCHESTRATION.FILE_MAX_OUTPUT,
          messages: [
            { role: 'system', content: FILE_SYSTEM },
            { role: 'user', content: userPrompt },
          ],
        },
        { timeout: ORCHESTRATION.FILE_TIMEOUT_MS, maxRetries: 0 },
      )
      inputTokens += resp.usage?.prompt_tokens ?? 0
      outputTokens += resp.usage?.completion_tokens ?? 0

      const content = stripFences(resp.choices[0]?.message?.content ?? '')
      const finish = resp.choices[0]?.finish_reason
      if (finish === 'length') {
        reason = 'cut off at token limit'
      } else if (!content.trim()) {
        reason = 'empty response'
      } else if (!isValidContent(spec, content)) {
        reason = 'invalid content (JSON parse failed)'
      } else {
        return { ok: true, content, attempts, inputTokens, outputTokens, reason: null }
      }
    } catch (err) {
      const status = (err as { status?: number })?.status
      reason = status
        ? `HTTP ${status}${status === 429 ? ' (rate limited)' : ''}`
        : err instanceof Error
          ? err.message.slice(0, 120)
          : 'request failed'
      // Rate limits / transient errors benefit from a longer pause before retrying.
      if (status === 429) await sleep(2_000 * (attempt + 1))
    }

    // Backoff between attempts (skip after the final one).
    if (attempt < ORCHESTRATION.FILE_MAX_RETRIES) await sleep(500 * (attempt + 1))
  }

  return { ok: false, content: '', attempts, inputTokens, outputTokens, reason }
}

export interface GenerateFilesResult {
  files: FileChange[]
  /** Paths that failed all attempts — surfaced to the user instead of silently dropped. */
  failed: string[]
  attempts: number
  inputTokens: number
  outputTokens: number
}

/**
 * Generate every file in the manifest, each as its own small validated call, with bounded concurrency.
 * A file that fails all retries is recorded in `failed` (never silently swallowed like the old workers).
 */
export async function generateFilesInParallel(
  envId: string,
  specs: FileSpec[],
  prompt: string,
  manifest: FileManifest,
  memory: string | null,
  onProgress?: (msg: string) => void | Promise<void>,
): Promise<GenerateFilesResult> {
  // Pre-read any files that already exist so edits keep their surrounding code.
  const existing = new Map<string, string>()
  for (const f of await readWorkspaceFilesParallel(envId, specs.map((s) => s.path))) {
    existing.set(f.path, f.content)
  }

  const files: FileChange[] = []
  const failed: string[] = []
  let attempts = 0
  let inputTokens = 0
  let outputTokens = 0
  let done = 0
  let index = 0

  async function pump() {
    while (index < specs.length) {
      const spec = specs[index++]!
      const r = await generateOneFile(spec, prompt, manifest, memory, existing.get(spec.path))
      attempts += r.attempts
      inputTokens += r.inputTokens
      outputTokens += r.outputTokens
      if (r.ok) {
        files.push({ path: spec.path, content: r.content })
      } else {
        failed.push(spec.path)
        // Visibility: the old pipeline dropped failed workers with no trace. Log path + reason.
        console.warn(
          `[file-generator] failed after ${r.attempts} attempt(s): ${spec.path} — ${r.reason ?? 'unknown'}`,
        )
      }
      done += 1
      await onProgress?.(
        `Generated ${done}/${specs.length} files${failed.length > 0 ? ` (${failed.length} failed)` : ''}…`,
      )
    }
  }

  const lanes = Array.from(
    { length: Math.min(ORCHESTRATION.FILE_CONCURRENCY, Math.max(specs.length, 1)) },
    () => pump(),
  )
  await Promise.all(lanes)

  return { files, failed, attempts, inputTokens, outputTokens }
}
