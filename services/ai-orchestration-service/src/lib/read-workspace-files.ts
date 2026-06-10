import { readContainerFile } from './environment-client.js'

const DEFAULT_CONCURRENCY = 8

/**
 * Read multiple workspace files in parallel (bounded concurrency).
 */
export async function readWorkspaceFilesParallel(
  envId: string,
  paths: string[],
  concurrency = DEFAULT_CONCURRENCY,
): Promise<{ path: string; content: string }[]> {
  if (paths.length === 0) return []

  const results: { path: string; content: string }[] = []
  let index = 0

  async function worker() {
    while (index < paths.length) {
      const i = index++
      const p = paths[i]!
      try {
        const content = await readContainerFile(envId, p)
        if (typeof content === 'string') results.push({ path: p, content })
      } catch {
        // ignore unreadable paths
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, paths.length) }, () => worker())
  await Promise.all(workers)
  return results
}
