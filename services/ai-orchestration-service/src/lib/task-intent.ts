export type TaskIntentMode = 'code' | 'git_only' | 'code_then_git'

export type TaskGitAction = 'commit_push' | 'init_push' | 'create_repo_push'

export type TaskIntent = {
  mode: TaskIntentMode
  gitAction?: TaskGitAction
  commitMessage?: string
  repoName?: string
  privateRepo?: boolean
}

export type TaskGitContext = {
  accessToken: string
  cloneRepositoryUrl: string | null
  authorName: string
  authorEmail: string
}

const GIT_VERB_RE =
  /\b(git|github|commit|push|repository|repositories|repo|repos|init|initialize|initialise)\b/i

const CREATE_REPO_RE =
  /\b(create|new|make|add)\b.{0,40}\b(repo|repository|repositories)\b|\b(repo|repository)\b.{0,40}\b(create|new)\b|\binit(?:ialize|ialise)?\b.{0,20}\b(git|repo|repository)\b/i

const PUSH_RE = /\b(push|commit)\b/i

const CODE_WORK_RE =
  /\b(build|implement|add|write|create|fix|update|refactor|design|page|component|feature|api|endpoint|ui|layout|style)\b/i

function slugifyRepoName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return s.length >= 1 ? s : 'synaro-project'
}

/** User-supplied commit message only — otherwise the orchestrator generates Conventional Commits text. */
function extractCommitMessage(prompt: string): string | undefined {
  const quoted = prompt.match(/(?:message|commit)\s*[:=]\s*["']([^"']+)["']/i)
  if (quoted?.[1]?.trim()) return quoted[1].trim().slice(0, 4000)

  const withMsg = prompt.match(/\bcommit\b[^.]{0,80}\bwith\s+(?:message\s+)?(.+)$/i)
  if (withMsg?.[1]?.trim()) return withMsg[1].trim().slice(0, 4000)

  return undefined
}

function inferRepoName(prompt: string, projectSlug?: string): string {
  if (projectSlug?.trim()) return slugifyRepoName(projectSlug)

  const named =
    prompt.match(/\b(?:repo(?:sitory)?|project)\s+(?:called|named|name)\s+["']?([a-zA-Z0-9._-]+)["']?/i) ??
    prompt.match(/\bnamed\s+["']?([a-zA-Z0-9._-]+)["']?/i)
  if (named?.[1]) return slugifyRepoName(named[1])

  return 'synaro-project'
}

/**
 * Detect git-only / code+git intents without calling the LLM (avoids Moonshot failures for git prompts).
 */
export function classifyTaskIntent(
  prompt: string,
  hasLinkedRepo: boolean,
  projectSlug?: string,
): TaskIntent {
  const text = prompt.trim()
  if (!text || !GIT_VERB_RE.test(text)) {
    return { mode: 'code' }
  }

  const wantsPush = PUSH_RE.test(text)
  const wantsCreate = CREATE_REPO_RE.test(text) || (!hasLinkedRepo && /\bgit\b/i.test(text))
  const wantsGit = wantsPush || wantsCreate

  if (!wantsGit) {
    return { mode: 'code' }
  }

  // "Create a GitHub repo" must not count as "create a feature/page".
  const wantsCode =
    CODE_WORK_RE.test(text) &&
    !CREATE_REPO_RE.test(text) &&
    !/^(commit|push|init|initialize)\b/i.test(text) &&
    !/\bonly\b.{0,20}\b(push|commit)\b/i.test(text) &&
    !/\b(push|commit)\b.{0,30}\b(this\s+)?project\b/i.test(text)

  let gitAction: TaskGitAction
  if (wantsCreate && !hasLinkedRepo) {
    gitAction = 'create_repo_push'
  } else if (wantsCreate && hasLinkedRepo) {
    gitAction = 'commit_push'
  } else if (hasLinkedRepo) {
    gitAction = 'commit_push'
  } else {
    gitAction = 'create_repo_push'
  }

  const mode: TaskIntentMode = wantsCode ? 'code_then_git' : 'git_only'

  return {
    mode,
    gitAction,
    commitMessage: extractCommitMessage(text),
    repoName: gitAction === 'create_repo_push' ? inferRepoName(text, projectSlug) : undefined,
    privateRepo: /\bprivate\b/i.test(text),
  }
}
