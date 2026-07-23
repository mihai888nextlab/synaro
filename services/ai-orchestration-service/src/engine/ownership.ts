import type { WorkerSpec } from './types.js'
import { ORCHESTRATION } from '../lib/kimi.js'

/** Normalize a workspace-relative path/pattern for comparison. */
export function normalizePath(p: string): string {
  return p.trim().replace(/^\.\/+/, '').replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Does `filePath` fall under a single ownership entry? Supports:
 * - exact match ("src/app.ts")
 * - directory prefix ("src/api" or "src/api/" or "src/api/*")
 * - extension glob ("*.css")
 */
function matchesEntry(filePath: string, entry: string): boolean {
  const p = normalizePath(filePath)
  let e = normalizePath(entry)
  if (!e) return false
  if (e === p) return true
  if (e.endsWith('/*')) e = e.slice(0, -2)
  if (e.startsWith('*.')) return p.endsWith(e.slice(1))
  // Treat a directory-like entry as a prefix.
  if (!e.split('/').pop()!.includes('.')) return p === e || p.startsWith(`${e}/`)
  return false
}

/** True when `filePath` is within a worker's owned set. Empty set = unrestricted. */
export function isOwned(filePath: string, ownedFiles: string[]): boolean {
  if (ownedFiles.length === 0) return true
  return ownedFiles.some((entry) => matchesEntry(filePath, entry))
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items))
}

/**
 * Guarantee non-overlapping ownership so parallel workers never target the same file.
 * The model isn't trusted to partition perfectly: exact-duplicate ownership entries are
 * assigned to the first claiming worker (first-wins); a worker left with nothing is dropped.
 * Caps the worker count. (A residual same-file collision is still caught at merge time.)
 */
export function enforceDisjointOwnership(workers: WorkerSpec[]): WorkerSpec[] {
  const claimed = new Set<string>()
  const out: WorkerSpec[] = []

  for (const w of workers.slice(0, ORCHESTRATION.MAX_WORKERS)) {
    const owned = uniq((w.ownedFiles ?? []).map(normalizePath).filter(Boolean)).filter(
      (entry) => !claimed.has(entry),
    )
    owned.forEach((entry) => claimed.add(entry))
    if (owned.length === 0) continue // fully overlapped with an earlier worker — nothing left to do
    out.push({
      role: (w.role || 'worker').trim(),
      goal: (w.goal || '').trim(),
      ownedFiles: owned,
      filesToRead: uniq((w.filesToRead ?? []).map(normalizePath).filter(Boolean)),
    })
  }

  return out
}
