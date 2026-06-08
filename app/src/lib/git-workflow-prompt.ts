/**
 * Lightweight git-intent detection for the chat UI (matches ai-orchestration task-intent rules).
 * Used to skip "clarifying questions" that only apply to greenfield code generation.
 */

const GIT_VERB_RE =
  /\b(git|github|commit|push|repository|repositories|repo|repos|init|initialize|initialise)\b/i;

const CREATE_REPO_RE =
  /\b(create|new|make|add)\b.{0,40}\b(repo|repository|repositories)\b|\b(repo|repository)\b.{0,40}\b(create|new)\b|\binit(?:ialize|ialise)?\b.{0,20}\b(git|repo|repository)\b/i;

const PUSH_RE = /\b(push|commit)\b/i;

const CODE_WORK_RE =
  /\b(build|implement|add|write|create|fix|update|refactor|design|page|component|feature|api|endpoint|ui|layout|style)\b/i;

/** True when the user is asking for git/GitHub operations only (no new feature build). */
export function isGitOnlyWorkflowPrompt(prompt: string): boolean {
  const text = prompt.trim();
  if (!text || !GIT_VERB_RE.test(text)) return false;

  const wantsPush = PUSH_RE.test(text);
  const wantsCreate = CREATE_REPO_RE.test(text) || /\bgit\b/i.test(text);
  if (!wantsPush && !wantsCreate) return false;

  const wantsCode =
    CODE_WORK_RE.test(text) &&
    !CREATE_REPO_RE.test(text) &&
    !/^(commit|push|init|initialize)\b/i.test(text) &&
    !/\bonly\b.{0,20}\b(push|commit)\b/i.test(text) &&
    !/\b(push|commit)\b.{0,30}\b(this\s+)?project\b/i.test(text);

  return !wantsCode;
}
