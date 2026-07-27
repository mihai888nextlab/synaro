import { readContainerFile } from './environment-client.js'

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

/**
 * Inspect the workspace and describe the EXISTING project's stack so the AI is grounded: it won't ask
 * "what framework?" for an app that already exists, and won't re-scaffold or switch stacks. Reads
 * package.json (framework/language/styling) plus a project AGENTS.md/README for conventions, if present.
 * Returns null for an empty/new workspace (nothing to ground on).
 */
export async function detectProjectContext(envId: string): Promise<string | null> {
  const parts: string[] = []

  let pkgRaw: string | null = null
  try {
    pkgRaw = await readContainerFile(envId, 'package.json')
  } catch {
    pkgRaw = null
  }

  if (pkgRaw) {
    let pkg: PackageJson = {}
    try {
      pkg = JSON.parse(pkgRaw) as PackageJson
    } catch {
      pkg = {}
    }
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    const has = (n: string) => Boolean(deps[n])
    const framework = has('next')
      ? 'Next.js'
      : has('nuxt')
        ? 'Nuxt'
        : has('@angular/core')
          ? 'Angular'
          : has('vue')
            ? 'Vue'
            : has('svelte')
              ? 'Svelte'
              : has('astro')
                ? 'Astro'
                : has('react')
                  ? 'React'
                  : has('express')
                    ? 'Express'
                    : has('fastify')
                      ? 'Fastify'
                      : null
    const language = has('typescript') ? 'TypeScript' : 'JavaScript'
    const styling = has('tailwindcss') ? 'Tailwind CSS' : null
    const stack = [framework, language, styling].filter(Boolean).join(' + ')
    if (stack) parts.push(`Stack: ${stack}.`)
    const scripts = Object.keys(pkg.scripts ?? {})
    if (scripts.length > 0) parts.push(`package.json scripts: ${scripts.join(', ')}.`)
  }

  // Honor a project-level AGENTS.md / README for extra conventions, if the user added one.
  for (const doc of ['AGENTS.md', 'README.md']) {
    try {
      const content = await readContainerFile(envId, doc)
      if (content && content.trim()) {
        parts.push(`${doc}:\n${content.trim().slice(0, 1200)}`)
        break
      }
    } catch {
      // ignore
    }
  }

  if (parts.length === 0) return null

  return [
    'PROJECT CONTEXT — an app ALREADY EXISTS in this workspace. Do NOT change the framework, language, ' +
      'or styling library; do NOT re-scaffold or recreate the project. Make changes that fit the existing setup.',
    ...parts,
  ].join('\n')
}
