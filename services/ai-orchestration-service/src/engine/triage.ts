import { kimi, MODELS } from '../lib/kimi.js'

export type TaskComplexity = 'simple' | 'complex'

export interface Triage {
  complexity: TaskComplexity
  /** Best-guess set of existing files the change touches (used to seed the single-edit pass). */
  files: string[]
  inputTokens: number
  outputTokens: number
}

const TRIAGE_SYSTEM = `You are a triage router for an AI coding system. Decide whether a task is SIMPLE or COMPLEX, and list the existing files it most likely touches.

SIMPLE = a localized change that one engineer can do in a single pass without splitting work: edit/add a few files, a small feature, a bug fix, a copy/style tweak, wiring one component or endpoint.
COMPLEX = a large or greenfield build that genuinely benefits from splitting into parallel role-workers: a new app from scratch, a multi-surface feature spanning backend + UI + config, a big refactor across many files.

Bias toward SIMPLE. Only choose COMPLEX when the work clearly spans several independent areas at once.

Return ONLY valid JSON: { "complexity": "simple" | "complex", "files": ["existing/paths/likely/touched"] }
- "files" lists at most 8 existing repo paths relevant to the task (empty array is fine for a brand-new project).
- Return ONLY the JSON, no prose.`

/**
 * Cheap fast-model triage: is this task simple enough for a single targeted-edit pass, or does it
 * warrant the full planner → parallel workers → integrator fan-out? Falls back to `complex` only
 * when the model is unusable — a wrong "simple" just runs one big edit, which is the safe default.
 */
export async function triageTask(
  prompt: string,
  repoTree: string,
  memory: string | null,
): Promise<Triage> {
  const userPrompt = [
    memory ? `Context — ${memory}\n` : '',
    `Task: ${prompt}`,
    '',
    'Repository files:',
    repoTree || '(empty — new project)',
  ].join('\n')

  try {
    const response = await kimi.chat.completions.create({
      model: MODELS.PLAN,
      max_tokens: 500,
      messages: [
        { role: 'system', content: TRIAGE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
      complexity?: unknown
      files?: unknown
    }
    const complexity: TaskComplexity = parsed.complexity === 'complex' ? 'complex' : 'simple'
    const files = Array.isArray(parsed.files)
      ? (parsed.files as unknown[]).filter((p): p is string => typeof p === 'string').slice(0, 8)
      : []

    return {
      complexity,
      files,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }
  } catch {
    // Triage is best-effort. On any failure default to the simple single-pass path — it is faster
    // and the health/self-heal loop still catches a plan that turned out to need more work.
    return { complexity: 'simple', files: [], inputTokens: 0, outputTokens: 0 }
  }
}
