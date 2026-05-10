import fs from 'fs/promises'
import path from 'path'

const PROJECTS_BASE_PATH = process.env.PROJECTS_PATH ?? '/projects'

// File extensions we care about — skip binaries, lock files, etc.
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.prisma',
  '.yaml', '.yml', '.env.example', '.md', '.sql',
  '.html', '.css', '.scss', '.py', '.go', '.rs',
  '.sh', '.dockerfile', 'Dockerfile',
])

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  'coverage', '.cache', '__pycache__', '.turbo',
])

export interface FileEntry {
  path: string       // relative to project root
  size: number       // bytes
}

export interface FileWithContent extends FileEntry {
  content: string
}

// Get the full path for a project
export function getProjectPath(projectId: string): string {
  return path.join(PROJECTS_BASE_PATH, projectId)
}

// Recursively list all relevant files in a project
export async function listProjectFiles(projectId: string): Promise<FileEntry[]> {
  const projectPath = getProjectPath(projectId)
  const files: FileEntry[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue

      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(projectPath, fullPath)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name) || entry.name
        if (ALLOWED_EXTENSIONS.has(ext)) {
          const stat = await fs.stat(fullPath)
          // Skip files larger than 100kb
          if (stat.size < 100_000) {
            files.push({ path: relativePath, size: stat.size })
          }
        }
      }
    }
  }

  await walk(projectPath)
  return files
}

// Read specific files by their relative paths
export async function readFiles(projectId: string, relativePaths: string[]): Promise<FileWithContent[]> {
  const projectPath = getProjectPath(projectId)
  const results: FileWithContent[] = []

  for (const relativePath of relativePaths) {
    const fullPath = path.join(projectPath, relativePath)
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      const stat = await fs.stat(fullPath)
      results.push({ path: relativePath, size: stat.size, content })
    } catch {
      // file doesn't exist yet, skip
    }
  }

  return results
}

// Write file changes returned by AI
export async function applyFileChanges(
  projectId: string,
  changes: { path: string; content: string }[]
): Promise<void> {
  const projectPath = getProjectPath(projectId)

  for (const change of changes) {
    const fullPath = path.join(projectPath, change.path)
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, change.content, 'utf-8')
  }
}

// Build a compact repo tree string for the analyze prompt
export function buildRepoTree(files: FileEntry[]): string {
  return files.map(f => `${f.path} (${Math.round(f.size / 1024)}kb)`).join('\n')
}
