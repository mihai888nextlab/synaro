// Shared types for the multi-agent pipeline (planner → parallel workers → integrator → health loop).

export interface FileChange {
  path: string
  content: string
  /** Previous workspace content when the file existed before this task (for diffing). */
  previousContent?: string | null
}

/** One role-specialized worker and the slice of the app it owns. */
export interface WorkerSpec {
  /** e.g. "design", "backend", "ui" — for progress display only. */
  role: string
  /** What this worker should accomplish. */
  goal: string
  /** Files this worker may create/modify. Empty = unrestricted (single-worker fallback). */
  ownedFiles: string[]
  /** Existing files this worker should read for context (not necessarily owned). */
  filesToRead: string[]
}

export interface Plan {
  summary: string
  workers: WorkerSpec[]
}

export interface WorkerOutput {
  role: string
  changes: FileChange[]
  inputTokens: number
  outputTokens: number
}

export interface HealthResult {
  healthy: boolean
  portOpen: boolean
  httpStatus: number | null
  /** Tail of /tmp/app.log. */
  log: string
  /** Human-readable reason it's unhealthy (log excerpt / probe error), or null when healthy. */
  error: string | null
}
