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
      status: { in: ['DONE', 'FAILED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: ORCHESTRATION.MEMORY_TASKS,
    select: { prompt: true, status: true, result: true, errorMessage: true },
  })
  if (tasks.length === 0) return null

  const lines = ['Recent work on this project (oldest first) — build on this, do not repeat it:']
  for (const t of tasks.reverse()) {
    if (t.status === 'FAILED') {
      lines.push(
        `- [FAILED] "${truncate(t.prompt, 140)}" — error: ${truncate(t.errorMessage ?? 'unknown', 200)}`,
      )
    } else {
      lines.push(`- "${truncate(t.prompt, 140)}" — ${truncate(summaryOf(t.result) ?? 'done', 200)}`)
    }
  }
  return lines.join('\n')
}
