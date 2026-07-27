import { prisma } from './prisma.js'
import { ORCHESTRATION } from './kimi.js'

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Pull `result.summary` out of a stored Task.result JSON blob, if present. */
function summaryOf(result: unknown): string | null {
  if (result && typeof result === 'object' && 'summary' in result) {
    const s = (result as { summary?: unknown }).summary
    if (typeof s === 'string' && s.trim()) return s
  }
  return null
}

/**
 * Compact "prior work" context replayed on each task so follow-ups (e.g. "fix the bug")
 * build on what was already done instead of starting from zero. Returns null when there's
 * no relevant history. Ordered oldest → newest.
 */
export async function loadRecentTaskContext(
  projectId: string,
  currentTaskId: string,
): Promise<string | null> {
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      id: { not: currentTaskId },
      // Only successful tasks. FAILED tasks were replayed as "[FAILED] … do not repeat", which
      // poisoned retries of the same/similar prompt (the model refused to redo the requested work).
      status: { in: ['DONE'] },
    },
    orderBy: { createdAt: 'desc' },
    take: ORCHESTRATION.MEMORY_TASKS,
    select: { prompt: true, status: true, result: true, errorMessage: true },
  })
  if (tasks.length === 0) return null

  // Framed as neutral context, NOT "do not repeat" — the previous framing made the model think the
  // work was already done and return no changes, which failed follow-up prompts.
  const lines = [
    'Changes already applied to this project (oldest first) — the current files already reflect these. ' +
      'Use this only as context; your job is to make the NEW change described in the task below:',
  ]
  for (const t of tasks.reverse()) {
    lines.push(`- "${truncate(t.prompt, 140)}" — ${truncate(summaryOf(t.result) ?? 'done', 200)}`)
  }
  return lines.join('\n')
}
