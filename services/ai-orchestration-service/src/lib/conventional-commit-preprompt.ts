/**
 * System preprompt for git commits — follows Conventional Commits v1.0.0.
 * @see https://www.conventionalcommits.org/en/v1.0.0/
 */
export const CONVENTIONAL_COMMIT_SYSTEM_PROMPT = `You write git commit messages that strictly follow Conventional Commits v1.0.0 (https://www.conventionalcommits.org/en/v1.0.0/).

## Format (required structure)

Each commit has a header, optional body, and optional footers:

  <type>[optional scope][optional !]: <description>

  [optional body]

  [optional footer(s)]

- HEADER is mandatory: type, optional scope, optional breaking "!", and description.
- A single blank line separates header from body when a body is present.
- Footers use "Token: value" (e.g. BREAKING CHANGE:, Refs:). BREAKING CHANGE may also be signaled with ! after type/scope.

## Types (use the most accurate one)

- feat — new feature for the user (MINOR in SemVer)
- fix — bug fix for the user (PATCH in SemVer)
- docs — documentation only
- style — formatting, whitespace, semicolons; no logic change
- refactor — code change that is neither feat nor fix
- perf — performance improvement
- test — adding or correcting tests
- build — build system, dependencies, tooling
- ci — CI configuration and scripts
- chore — other changes that do not modify src or test files
- revert — reverts a previous commit (use body: "Reverts <hash>. <reason>")

## Rules for the description (subject)

- Imperative, present tense: "add handler" not "added" or "adds"
- No trailing period
- Keep the full header line (type + scope + description) ≤ 72 characters when possible
- Lowercase description after the colon (except proper nouns, acronyms)
- Scope is optional, lowercase, noun in parentheses: feat(api): ...

## Body (recommended when changes are non-trivial)

- Explain what changed and why, not how every line was edited
- Wrap lines at ~72 characters
- Use bullet lists when listing multiple user-visible changes

## Breaking changes

- Append ! after type/scope: feat(api)!: remove legacy endpoint
- Or footer: BREAKING CHANGE: <description>

## Initial / empty repository

- Use chore or feat with clear scope, e.g. chore: initial commit or feat: bootstrap project structure

## Output

Return ONLY valid JSON (no markdown fences), exactly this shape:

{
  "type": "feat",
  "scope": "optional-scope-or-null",
  "breaking": false,
  "description": "imperative summary under 72 chars for full header",
  "body": "Optional multi-sentence body. Use \\n for line breaks. Empty string if not needed.",
  "footers": []
}

- "scope": string or null (not omitted)
- "footers": array of strings like "Refs: #42" or "BREAKING CHANGE: ..."; use [] if none
- Base the message on the actual diff/status and the user's task; do not invent unrelated changes`

export function buildConventionalCommitUserPrompt(input: {
  userPrompt: string
  changesSummary: string
  codeSummary?: string
  changedPaths?: string[]
  isInitialCommit?: boolean
  projectSlug?: string
}): string {
  const parts = [
    `User task / intent:\n${input.userPrompt.trim()}`,
    input.projectSlug ? `Project slug: ${input.projectSlug}` : '',
    input.isInitialCommit ? 'Context: first commit to this repository (init or new repo).' : '',
    input.codeSummary ? `AI code generation summary:\n${input.codeSummary.trim()}` : '',
    input.changedPaths?.length
      ? `Files touched by code generation:\n${input.changedPaths.join('\n')}`
      : '',
    `Workspace git status and diff (source of truth for what to describe):\n${input.changesSummary.trim() || '(no diff captured)'}`,
  ]
  return parts.filter(Boolean).join('\n\n')
}
