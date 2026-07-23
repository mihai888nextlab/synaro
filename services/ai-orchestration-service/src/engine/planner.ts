import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { enforceDisjointOwnership } from './ownership.js'
import type { Plan, WorkerSpec } from './types.js'

const PLANNER_SYSTEM = `You are the planner for a team of AI coding workers. You break a task into role-specialized workers that will run IN PARALLEL on the SAME repository.

Critical rule: workers run at the same time and CANNOT see each other's files, so each file must be owned by exactly ONE worker. Partition the work by files with NO overlap.

Return ONLY valid JSON in this exact shape:
{
  "summary": "one sentence describing the overall plan",
  "workers": [
    {
      "role": "short label, e.g. backend / ui / styles / config",
      "goal": "what this worker must build or change",
      "ownedFiles": ["exact paths or dir prefixes this worker may create/modify"],
      "filesToRead": ["existing files this worker should read for context"]
    }
  ]
}

Rules:
- Split by files, not vibes. Never let two workers own the same file. A file that mixes concerns (e.g. a component with markup + logic) goes to ONE worker.
- Prefer 1-${ORCHESTRATION.MAX_WORKERS} workers. Use fewer for small tasks; a tiny change can be a single worker.
- ownedFiles may be exact paths ("src/api/users.ts"), directory prefixes ("src/api"), or extension globs ("*.css").
- Include, across all workers, every file needed for the feature to work end-to-end (new files included).
- Return ONLY the JSON, no prose.`

/**
 * Ask the planner to decompose the task into disjoint-ownership role-workers.
 * Enforces non-overlapping ownership in code and falls back to a single unrestricted
 * worker if the model returns nothing usable.
 */
export async function planWork(
  prompt: string,
  repoTree: string,
  memory: string | null,
): Promise<{ plan: Plan; inputTokens: number; outputTokens: number }> {
  const userPrompt = [
    memory ? `Context — ${memory}\n` : '',
    `Task: ${prompt}`,
    '',
    'Repository files:',
    repoTree || '(empty — new project)',
  ].join('\n')

  const response = await kimi.chat.completions.create({
    model: MODELS.PLAN,
    max_tokens: 1_500,
    messages: [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { summary?: unknown; workers?: unknown } = {}
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as typeof parsed
  } catch {
    parsed = {}
  }

  const rawWorkers: WorkerSpec[] = Array.isArray(parsed.workers)
    ? (parsed.workers as unknown[])
        .filter((w): w is Record<string, unknown> => Boolean(w) && typeof w === 'object')
        .map((w) => ({
          role: typeof w.role === 'string' ? w.role : 'worker',
          goal: typeof w.goal === 'string' ? w.goal : prompt,
          ownedFiles: Array.isArray(w.ownedFiles)
            ? (w.ownedFiles as unknown[]).filter((p): p is string => typeof p === 'string')
            : [],
          filesToRead: Array.isArray(w.filesToRead)
            ? (w.filesToRead as unknown[]).filter((p): p is string => typeof p === 'string')
            : [],
        }))
    : []

  let workers = enforceDisjointOwnership(rawWorkers)

  // Fallback: planner produced nothing usable → one unrestricted worker does the whole task.
  if (workers.length === 0) {
    workers = [{ role: 'builder', goal: prompt, ownedFiles: [], filesToRead: [] }]
  }

  return {
    plan: {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Implement the requested changes.',
      workers,
    },
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}
