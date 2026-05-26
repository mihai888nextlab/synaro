import { kimi, MODELS } from './kimi.js'
import {
  CONVENTIONAL_COMMIT_SYSTEM_PROMPT,
  buildConventionalCommitUserPrompt,
} from './conventional-commit-preprompt.js'

export type ConventionalCommitParts = {
  type: string
  scope: string | null
  breaking: boolean
  description: string
  body: string
  footers: string[]
}

const ALLOWED_TYPES = new Set([
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
])

export function formatConventionalCommit(parts: ConventionalCommitParts): string {
  const type = ALLOWED_TYPES.has(parts.type) ? parts.type : 'chore'
  const scope =
    parts.scope?.trim().replace(/[()]/g, '').toLowerCase().slice(0, 40) || null
  const breaking = Boolean(parts.breaking)
  const description = parts.description.trim().replace(/\s+/g, ' ').slice(0, 200)
  const header = `${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${description}`

  const body = parts.body.trim()
  const footers = parts.footers.map((f) => f.trim()).filter(Boolean)

  const blocks = [header]
  if (body) blocks.push(body)
  if (footers.length) blocks.push(footers.join('\n'))
  return blocks.join('\n\n').slice(0, 4000)
}

export function parseConventionalCommitResponse(raw: string): ConventionalCommitParts | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const type = typeof parsed.type === 'string' ? parsed.type.trim().toLowerCase() : 'chore'
    const scope =
      parsed.scope === null || parsed.scope === undefined
        ? null
        : typeof parsed.scope === 'string'
          ? parsed.scope.trim() || null
          : null
    const breaking = parsed.breaking === true
    const description =
      typeof parsed.description === 'string' && parsed.description.trim()
        ? parsed.description.trim()
        : 'update project files'
    const body = typeof parsed.body === 'string' ? parsed.body : ''
    const footers = Array.isArray(parsed.footers)
      ? parsed.footers.filter((f): f is string => typeof f === 'string')
      : []
    return { type, scope, breaking, description, body, footers }
  } catch {
    return null
  }
}

function fallbackConventionalCommit(opts: {
  isInitialCommit?: boolean
  changedPaths?: string[]
  userPrompt: string
}): string {
  if (opts.isInitialCommit) {
    return formatConventionalCommit({
      type: 'chore',
      scope: null,
      breaking: false,
      description: 'initial commit',
      body: opts.userPrompt.trim().slice(0, 500),
      footers: [],
    })
  }
  const paths = opts.changedPaths?.filter(Boolean) ?? []
  const scope =
    paths.length === 1
      ? paths[0]!.split('/')[0]?.toLowerCase().replace(/[^a-z0-9-]/g, '') || null
      : null
  const hint = paths.length > 0 ? paths.slice(0, 3).join(', ') : 'project files'
  return formatConventionalCommit({
    type: /\bfix\b/i.test(opts.userPrompt) ? 'fix' : /\b(feat|add|implement)\b/i.test(opts.userPrompt) ? 'feat' : 'chore',
    scope,
    breaking: false,
    description: `update ${hint}`.slice(0, 72),
    body: '',
    footers: [],
  })
}

export type GenerateCommitMessageResult = {
  message: string
  inputTokens: number
  outputTokens: number
}

/** Generate a Conventional Commits message from workspace diff and user intent. */
export async function generateConventionalCommitMessage(input: {
  userPrompt: string
  changesSummary: string
  codeSummary?: string
  changedPaths?: string[]
  isInitialCommit?: boolean
  projectSlug?: string
}): Promise<GenerateCommitMessageResult> {
  const userContent = buildConventionalCommitUserPrompt(input)

  try {
    const response = await kimi.chat.completions.create({
      model: MODELS.ANALYZE,
      max_tokens: 800,
      messages: [
        { role: 'system', content: CONVENTIONAL_COMMIT_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const parts = parseConventionalCommitResponse(raw)
    const message = parts
      ? formatConventionalCommit(parts)
      : fallbackConventionalCommit(input)

    return {
      message,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }
  } catch {
    return {
      message: fallbackConventionalCommit(input),
      inputTokens: 0,
      outputTokens: 0,
    }
  }
}
