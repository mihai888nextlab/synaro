/** Directory names omitted from the workspace file tree (dependencies, caches, tooling). */
export const WORKSPACE_TREE_PRUNE_DIR_NAMES = [
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.turbo',
  '.npm',
  '.pnpm-store',
  '.yarn',
  '.parcel-cache',
  '.nuxt',
  '.output',
  '.vercel',
  '.netlify',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'vendor',
  'target',
  '.gradle',
  '.synaro-workspace',
] as const

const PRUNE_DIR_SET = new Set<string>(WORKSPACE_TREE_PRUNE_DIR_NAMES)

/** Lock / generated manifests — not application source. */
const IGNORED_FILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'npm-shrinkwrap.json',
])

function normalizeRelativePath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Whether a repo-relative path should appear in the project file tree. */
export function isWorkspaceTreePathVisible(relPath: string): boolean {
  const norm = normalizeRelativePath(relPath)
  if (!norm) return false

  const segments = norm.split('/').filter(Boolean)
  for (const seg of segments) {
    if (PRUNE_DIR_SET.has(seg)) return false
    // Hidden segments: `.npm`, `.env`, `.github`, etc.
    if (seg.startsWith('.')) return false
  }

  const base = segments[segments.length - 1] ?? ''
  if (IGNORED_FILE_NAMES.has(base)) return false
  if (base.endsWith('.log') || base.endsWith('.tsbuildinfo')) return false

  return true
}

export function filterWorkspaceTreePaths(paths: string[]): string[] {
  return paths.filter(isWorkspaceTreePathVisible)
}

export function buildWorkspaceFindPruneExpr(): string {
  return WORKSPACE_TREE_PRUNE_DIR_NAMES.map((name) => `-name ${JSON.stringify(name)}`).join(' -o ')
}
