import { kimi, MODELS, ORCHESTRATION } from '../lib/kimi.js'
import { buildRepoTree } from '../lib/filesystem.js'
import {
  getActiveEnvironment,
  getGitWorkspaceChangesSummary,
  gitPushWorkspace,
  listContainerFiles,
  readContainerFile,
  writeContainerFiles,
} from '../lib/environment-client.js'
import { generateConventionalCommitMessage } from '../lib/generate-commit-message.js'
import { createGithubRepository, verifyGithubPushAccess } from '../lib/github.js'
import {
  classifyTaskIntent,
  type TaskGitContext,
  type TaskIntent,
} from '../lib/task-intent.js'
import { streamKimiChatCompletion } from '../lib/kimi-stream.js'
import { readWorkspaceFilesParallel } from '../lib/read-workspace-files.js'
import { loadRecentTaskContext } from '../lib/memory.js'
import { detectProjectContext } from '../lib/project-context.js'
import { triageTask } from './triage.js'
import { planFiles } from './file-planner.js'
import { generateFilesInParallel } from './file-generator.js'
import { runEditPass } from './edit-pass.js'
import { runWorker, runFixPass } from './worker.js'
import { runAgentLoop } from './agent-loop.js'
import { runHealthCheck } from './health-check.js'
import { mergeChanges } from './parse-changes.js'
import type { HealthResult } from './types.js'
import { prisma } from '../lib/prisma.js'

type TaskStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'GENERATING'
  | 'APPLYING'
  | 'VERIFYING'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED'

class TaskCancelledError extends Error {
  constructor() {
    super('Task cancelled by user')
    this.name = 'TaskCancelledError'
  }
}

async function isTaskCancelled(taskId: string): Promise<boolean> {
  const row = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } })
  return row?.status === 'CANCELLED'
}

async function assertNotCancelled(taskId: string): Promise<void> {
  if (await isTaskCancelled(taskId)) throw new TaskCancelledError()
}

interface FileChange {
  path: string
  content: string
  /** Previous workspace content when the file existed before this task. */
  previousContent?: string | null
}

interface TaskGitOutcome {
  action: string
  branch?: string
  commitSha?: string | null
  commitMessage?: string
  remoteUrl?: string
  htmlUrl?: string
  noChanges?: boolean
  output?: string
}

interface TaskResult {
  changes: FileChange[]
  summary: string
  meta?: {
    /** Number of workspace files seen for this task. */
    exploredFiles: number
    /** Approximate number of AI calls made (plan + workers + integrator + fixes). */
    aiSteps: number
    /** Role-workers dispatched by the planner (legacy multi-worker path). */
    workers?: number
    /** Files touched for this task (file-by-file generation path). */
    filesGenerated?: number
    /** Files that failed to generate after retries (surfaced, not silently dropped). */
    filesFailed?: number
    /** Self-heal iterations run by the health loop. */
    healthIterations?: number
    /** Whether the app passed the health check. */
    healthy?: boolean
  }
  git?: TaskGitOutcome
  /** Set when a new GitHub repo was linked — app should persist on Project.cloneRepositoryUrl */
  linkedCloneRepositoryUrl?: string
}

async function updateTask(id: string, status: TaskStatus, extra?: object) {
  // Never overwrite a user cancel with DONE/FAILED from a still-running executeTask.
  if (status === 'DONE' || status === 'FAILED') {
    const row = await prisma.task.findUnique({ where: { id }, select: { status: true } })
    if (row?.status === 'CANCELLED') return row
  }
  return prisma.task.update({ where: { id }, data: { status, ...extra } })
}

async function updateProgress(id: string, progress: string) {
  return prisma.task.update({ where: { id }, data: { progress } })
}

/**
 * A throttled writer that pipes the model's live output into Task.streamContent so the chat UI can
 * show exactly what the AI is producing in real time. Writes are rate-limited (the model emits tokens
 * far faster than we want DB round-trips) and the payload is capped to the tail — enough to see it
 * working without bloating the row.
 */
function makeStreamWriter(taskId: string): (accumulated: string) => void {
  let lastWrite = 0
  const MIN_INTERVAL_MS = 400
  const TAIL_CHARS = 6_000
  return (accumulated: string) => {
    const now = Date.now()
    if (now - lastWrite < MIN_INTERVAL_MS) return
    lastWrite = now
    void prisma.task
      .update({ where: { id: taskId }, data: { streamContent: accumulated.slice(-TAIL_CHARS) } })
      .catch(() => {})
  }
}

// Step 1 — cheap call to identify which files are relevant
async function analyzeRelevantFiles(
  prompt: string,
  repoTree: string,
): Promise<{ files: string[]; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `You are a code analysis assistant. Given a repository file tree and a user task, return ONLY a JSON object listing the file paths relevant to completing the task.

Be selective — return only files that need to be read or modified. For new projects/features, include entry points, config files, and any files the new code will integrate with.

Return format: { "files": ["path/to/file.ts", ...] }
Return ONLY valid JSON, no explanation.`

  const userPrompt = `Task: ${prompt}\n\nRepository files:\n${repoTree}`

  const response = await kimi.chat.completions.create({
    model: MODELS.ANALYZE,
    max_tokens: 1_000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { files?: unknown } = {}
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { files?: unknown }
  } catch {
    parsed = {}
  }

  const files = Array.isArray(parsed.files)
    ? (parsed.files
        .filter((f): f is string => typeof f === 'string')
        .map((f) => f.trim())
        .filter((f) => f.length > 0))
    : []

  return {
    files,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

function formatTaskError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('Connection error') || err.message.includes('EAI_AGAIN')) {
      return 'Could not reach the AI provider (Moonshot). Check your network and KIMI_API_KEY, then try again.'
    }
    return err.message
  }
  return String(err)
}

function parseAnswerModelResponse(raw: string): { answer: string; needFiles: string[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
  if (!cleaned) return { answer: '', needFiles: [] }

  try {
    const parsed = JSON.parse(cleaned) as { answer?: unknown; needFiles?: unknown }
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
    const needFiles = Array.isArray(parsed.needFiles)
      ? parsed.needFiles
          .filter((p): p is string => typeof p === 'string')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : []
    if (answer) return { answer, needFiles }
    if (needFiles.length > 0) return { answer: '', needFiles }
  } catch {
    // Model returned prose instead of JSON — use it as the answer.
  }

  if (cleaned !== '{}' && !cleaned.startsWith('{')) {
    return { answer: cleaned, needFiles: [] }
  }

  return { answer: '', needFiles: [] }
}

/** Main orchestration function — reads from and writes to the running environment container. */
export async function executeTask(
  taskId: string,
  opts?: { gitContext?: TaskGitContext | null; projectSlug?: string; mode?: 'generate' | 'answer' },
): Promise<void> {
  const gitContext = opts?.gitContext
  const projectSlug = opts?.projectSlug
  const mode = opts?.mode ?? 'generate'
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let exploredFiles = 0
  let aiSteps = 0

  // Read-only Q&A mode: answer questions about the repo without modifying files.
  if (mode === 'answer') {
    try {
      await updateTask(taskId, 'ANALYZING')
      await updateProgress(taskId, 'Reading repository context…')
      await assertNotCancelled(taskId)

      const env = await getActiveEnvironment(task.projectId)
      if (!env) throw new Error('No active environment. Start the runtime to answer questions about this project.')

      const allPaths = await listContainerFiles(env.id)
      const repoTree = buildRepoTree(allPaths.map((p) => ({ path: p, size: 0 })))
      aiSteps += 1
      const analysis = await analyzeRelevantFiles(task.prompt, repoTree)
      totalInputTokens += analysis.inputTokens
      totalOutputTokens += analysis.outputTokens

      const allPathSet = new Set(allPaths)
      const seedCandidates = [
        'README.md',
        'package.json',
        'app/package.json',
        'pnpm-lock.yaml',
        'yarn.lock',
        'Dockerfile',
        'docker-compose.yml',
        'docker-compose.yaml',
        'app/README.md',
      ].filter((p) => allPathSet.has(p))

      const filesToRead = Array.from(new Set([...seedCandidates, ...(analysis.files ?? [])]))
        .filter((p) => allPathSet.has(p))
        .slice(0, 18)

      const existingFiles = await readWorkspaceFilesParallel(env.id, filesToRead)
      exploredFiles += existingFiles.length

      await updateTask(taskId, 'GENERATING', { streamContent: null })
      await updateProgress(taskId, 'Drafting answer…')
      await assertNotCancelled(taskId)

      const context = existingFiles
        .slice(0, 10)
        .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n')

      const answerOnce = async (extraFiles: { path: string; content: string }[]) => {
        const extraContext = extraFiles
          .slice(0, 10)
          .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
          .join('\n\n')

        const userContent =
          `Question: ${task.prompt}\n\n` +
          `Repository tree (paths only):\n${repoTree}\n\n` +
          `Repository context:\n${context || '(no files provided)'}\n\n` +
          (extraContext ? `Additional context:\n${extraContext}\n\n` : '')

        aiSteps += 1
        const response = await kimi.chat.completions.create({
          model: MODELS.GENERATE,
          max_tokens: 1200,
          messages: [
            {
              role: 'system',
              content:
                `You are a senior engineer helping a user understand their codebase.\n` +
                `Return ONLY valid JSON:\n` +
                `{"answer":"markdown answer here","needFiles":["optional/path"]}\n` +
                `Rules:\n` +
                `- "answer" must be a non-empty markdown string answering the question.\n` +
                `- Use the repository tree and file contents provided.\n` +
                `- If you can answer confidently, set needFiles to [].\n` +
                `- If you need more files, set answer to a short note and list up to 8 exact paths in needFiles.\n` +
                `- Do NOT modify files. Do NOT output code changes.\n`,
            },
            { role: 'user', content: userContent },
          ],
        })

        const raw = response.choices[0]?.message?.content ?? ''
        totalInputTokens += response.usage?.prompt_tokens ?? 0
        totalOutputTokens += response.usage?.completion_tokens ?? 0

        return parseAnswerModelResponse(raw)
      }

      const answerPlain = async (extraFiles: { path: string; content: string }[], stream: boolean) => {
        const extraContext = extraFiles
          .slice(0, 10)
          .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
          .join('\n\n')

        aiSteps += 1
        const messages = [
          {
            role: 'system' as const,
            content:
              `You are a senior engineer helping a user understand their codebase.\n` +
              `Answer the user's question in clear markdown using the repository context.\n` +
              `Do NOT modify files. Do NOT propose writing code unless asked.\n` +
              `If context is insufficient, say what you found and what is still missing.`,
          },
          {
            role: 'user' as const,
            content:
              `Question: ${task.prompt}\n\n` +
              `Repository tree:\n${repoTree}\n\n` +
              `File contents:\n${context || '(none)'}\n\n` +
              (extraContext ? `More files:\n${extraContext}\n\n` : ''),
          },
        ]

        if (stream) {
          const streamed = await streamKimiChatCompletion({
            taskId,
            messages,
            maxTokens: 1200,
            plainTextStream: true,
          })
          totalInputTokens += streamed.inputTokens
          totalOutputTokens += streamed.outputTokens
          return streamed.content
        }

        const response = await kimi.chat.completions.create({
          model: MODELS.GENERATE,
          max_tokens: 1200,
          messages,
        })

        const text = (response.choices[0]?.message?.content ?? '').trim()
        totalInputTokens += response.usage?.prompt_tokens ?? 0
        totalOutputTokens += response.usage?.completion_tokens ?? 0
        return text
      }

      // Stream the main answer into the chat as tokens arrive.
      let finalAnswer = await answerPlain([], true)

      if (!finalAnswer.trim()) {
        const first = await answerOnce([])
        let need = first.needFiles
          .filter((p) => allPathSet.has(p))
          .filter((p) => !existingFiles.some((f) => f.path === p))
          .slice(0, 8)

        finalAnswer = first.answer
        if (need.length > 0) {
          await updateProgress(taskId, `Reading ${need.length} more file${need.length === 1 ? '' : 's'} for your question…`)
          const extraFiles = await readWorkspaceFilesParallel(env.id, need)
          exploredFiles += extraFiles.length
          const second = await answerOnce(extraFiles)
          finalAnswer = second.answer || first.answer
        }

        if (!finalAnswer.trim()) {
          await updateProgress(taskId, 'Summarizing findings from the repository…')
          finalAnswer = await answerPlain([...existingFiles], true)
        } else {
          await prisma.task.update({
            where: { id: taskId },
            data: { streamContent: finalAnswer },
          })
        }
      }

      const result: TaskResult = {
        summary: finalAnswer.trim() || 'I could not find enough information in the repository to answer that question.',
        changes: [],
        meta: { exploredFiles, aiSteps },
      }
      await assertNotCancelled(taskId)
      await updateTask(taskId, 'DONE', {
        result,
        progress: null,
        streamContent: null,
        errorMessage: null,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      return
    } catch (err) {
      if (err instanceof TaskCancelledError || (await isTaskCancelled(taskId))) {
        return
      }
      const msg = formatTaskError(err)
      await updateTask(taskId, 'FAILED', {
        errorMessage: msg,
        progress: null,
        streamContent: null,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      return
    }
  }

  const runGitPush = async (
    envId: string,
    intent: TaskIntent,
    remoteUrl: string,
    initIfNeeded: boolean,
    gitMessageContext?: {
      userPrompt: string
      codeSummary?: string
      changedPaths?: string[]
    },
  ): Promise<TaskGitOutcome> => {
    if (!gitContext?.accessToken) {
      throw new Error('Connect your GitHub account in Settings to commit and push from AI chat.')
    }
    await updateProgress(taskId, 'Verifying GitHub push access...')
    await verifyGithubPushAccess(gitContext.accessToken, remoteUrl)

    let message = intent.commitMessage
    if (!message) {
      await updateProgress(taskId, 'Writing Conventional Commit message...')
      const changesSummary = await getGitWorkspaceChangesSummary(envId)
      const generated = await generateConventionalCommitMessage({
        userPrompt: gitMessageContext?.userPrompt ?? task.prompt,
        changesSummary,
        codeSummary: gitMessageContext?.codeSummary,
        changedPaths: gitMessageContext?.changedPaths,
        isInitialCommit: initIfNeeded,
        projectSlug,
      })
      totalInputTokens += generated.inputTokens
      totalOutputTokens += generated.outputTokens
      message = generated.message?.trim() || 'chore: update project files'
    }

    if (!message?.trim()) {
      throw new Error('Could not build a commit message for this push.')
    }

    await updateProgress(taskId, 'Committing and pushing to GitHub...')
    const push = await gitPushWorkspace(envId, {
      accessToken: gitContext.accessToken,
      gitRemoteUrl: remoteUrl,
      commitMessage: message,
      authorName: gitContext.authorName,
      authorEmail: gitContext.authorEmail,
      initIfNeeded,
    })
    if (!push.ok) {
      throw new Error(push.output || 'Git push failed')
    }
    return {
      action: intent.gitAction ?? 'commit_push',
      branch: push.branch,
      commitSha: push.commitSha,
      commitMessage: message,
      remoteUrl,
      noChanges: push.noChanges,
      output: push.output,
    }
  }

  const startedAt = Date.now()

  try {
    // ── Step 1: Find the running environment ──────────────────────────────
    await updateTask(taskId, 'ANALYZING')

    const env = await getActiveEnvironment(task.projectId)
    if (!env) {
      throw new Error(
        'No running environment found for this project. ' +
          'Start the environment using the runtime pill before sending AI tasks.',
      )
    }

    const hasLinkedRepo = Boolean(gitContext?.cloneRepositoryUrl?.trim())
    const intent = await classifyTaskIntent(task.prompt, hasLinkedRepo)

    // ── Git-only tasks (no code generation) ───────────────────────────────
    if (intent.mode === 'git_only') {
      if (!gitContext?.accessToken) {
        throw new Error('Connect your GitHub account in Settings to use Git commands from AI chat.')
      }

      let remoteUrl = gitContext.cloneRepositoryUrl?.trim() ?? ''
      let linkedCloneRepositoryUrl: string | undefined
      let htmlUrl: string | undefined

      if (intent.gitAction === 'create_repo_push' || (!remoteUrl && intent.gitAction !== 'commit_push')) {
        await updateProgress(taskId, 'Creating GitHub repository...')
        const repoName = intent.repoName ?? projectSlug ?? 'synaro-project'
        const created = await createGithubRepository(gitContext.accessToken, {
          name: repoName,
          private: intent.privateRepo,
          description: 'Created from Synaro',
        })
        remoteUrl = created.cloneRepositoryUrl
        htmlUrl = created.htmlUrl
        linkedCloneRepositoryUrl = created.cloneRepositoryUrl
      }

      if (!remoteUrl) {
        throw new Error(
          'This project has no GitHub repository linked. Ask to create a new repo or import a project from GitHub first.',
        )
      }

      const gitOutcome = await runGitPush(
        env.id,
        intent,
        remoteUrl,
        intent.gitAction === 'init_push' || intent.gitAction === 'create_repo_push',
        { userPrompt: task.prompt },
      )
      if (htmlUrl) gitOutcome.htmlUrl = htmlUrl

      const summary = gitOutcome.noChanges
        ? 'Working tree is clean — nothing new to commit.'
        : `Committed and pushed to GitHub (${gitOutcome.branch ?? 'main'}): ${gitOutcome.commitMessage?.split('\n')[0] ?? 'done'}.`

      await updateTask(taskId, 'DONE', {
        result: {
          summary,
          changes: [],
          git: gitOutcome,
          linkedCloneRepositoryUrl,
        },
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })
      return
    }

    const shouldGitAfterCode = intent.mode === 'code_then_git'

    const progress = async (msg: string) => {
      await assertNotCancelled(taskId)
      await updateProgress(taskId, msg)
    }

    // ── Context: existing project stack + recent-task memory ─────────────
    // The stack context grounds every stage (triage, planning, edits, generation) so the AI builds
    // ON the existing app instead of re-scaffolding or switching frameworks.
    await assertNotCancelled(taskId)
    const [projectContext, recentContext] = await Promise.all([
      detectProjectContext(env.id),
      loadRecentTaskContext(task.projectId, taskId),
    ])
    const memory = [projectContext, recentContext].filter(Boolean).join('\n\n') || null

    // ── Scan workspace ───────────────────────────────────────────────────
    await progress('Scanning your repository...')
    const allPaths = await listContainerFiles(env.id)

    await assertNotCancelled(taskId)
    await updateTask(taskId, 'GENERATING', { streamContent: null })

    let summary: string
    let generated: FileChange[]
    let filesFailed: string[] = []
    // Controls the verify/self-heal tail below (skipped for simple edits and — for now — the agent path).
    let isSimple = false
    // Content of each touched file BEFORE the task, for accurate diffs (agent path fills this in).
    let agentPrior: Map<string, string | null> | null = null

    // Live "what the AI is producing" stream → Task.streamContent → chat UI.
    const streamOut = makeStreamWriter(taskId)

    // ── Agentic tool-loop (flag-gated) vs. the one-shot pipeline ──────────
    // ORCHESTRATOR_MODE=agent runs the task as a tool-using agent that reads/edits/writes/runs commands
    // in the container directly until done. Flag off = byte-for-byte the existing pipeline below.
    if (process.env.ORCHESTRATOR_MODE === 'agent') {
      // A near-empty workspace = build-from-scratch: the agent must scaffold a whole app, which needs
      // scaffolding guidance and a larger step budget than a localized edit.
      const codeFileCount = allPaths.filter((p) => !p.split('/').pop()?.startsWith('.')).length
      const newProject = codeFileCount <= 2
      await progress(newProject ? 'Setting up the project...' : 'Working on it...')
      const agent = await runAgentLoop({
        envId: env.id,
        prompt: task.prompt,
        memory,
        newProject,
        repoFiles: allPaths,
        onActivity: progress,
        onStream: streamOut,
        assertNotCancelled: () => assertNotCancelled(taskId),
      })
      totalInputTokens += agent.inputTokens
      totalOutputTokens += agent.outputTokens
      aiSteps += agent.steps
      summary = agent.summary
      agentPrior = agent.prior
      isSimple = true // Phase 1: agent self-verifies via run_command; no separate verify tail.
      const finals = await readWorkspaceFilesParallel(env.id, agent.touched)
      generated = finals.map((f) => ({ path: f.path, content: f.content }))
    } else {
      const repoTree = buildRepoTree(allPaths.map((p) => ({ path: p, size: 0 })))

      // Triage first: most tasks are small and localized, and shouldn't pay the full
      // planner → parallel-workers → integrator fan-out tax. Only genuinely large/greenfield
      // builds take the multi-agent path; everything else runs a single targeted-edit pass.
      await progress('Sizing up the task...')
      aiSteps += 1
      const triage = await triageTask(task.prompt, repoTree, memory)
      totalInputTokens += triage.inputTokens
      totalOutputTokens += triage.outputTokens

      // A brand-new / near-empty workspace means a build-from-scratch, which is inherently multi-file.
      // Never route that through the single-pass "simple" edit — it produces one giant slow blob and
      // stalls. Force the robust file-by-file path whenever the repo has essentially no code yet.
      const codeFileCount = allPaths.filter((p) => !p.split('/').pop()?.startsWith('.')).length
      const isNewProject = codeFileCount <= 2
      isSimple = triage.complexity === 'simple' && !isNewProject

      if (isSimple) {
      // Fast path. First try a targeted search/replace edit (tiny output → quick); only if that
      // can't be applied cleanly do we fall back to a full-file rewrite (correct but slower).
      await progress('Making the change...')
      aiSteps += 1
      let editFallbackReason: string | null = null
      const edit = await runEditPass({
        envId: env.id,
        prompt: task.prompt,
        paths: triage.files,
        memory,
        onStream: streamOut,
        onFallback: (reason) => {
          editFallbackReason = reason
          console.warn(`[orchestrator] task ${taskId}: diff → full rewrite — ${reason}`)
        },
      })
      if (edit) {
        totalInputTokens += edit.inputTokens
        totalOutputTokens += edit.outputTokens
        generated = edit.changes
      } else {
        aiSteps += 1
        await progress(
          editFallbackReason ? `Refining the change (${editFallbackReason})...` : 'Refining the change...',
        )
        const single = await runWorker(
          env.id,
          { role: 'builder', goal: task.prompt, ownedFiles: [], filesToRead: triage.files },
          task.prompt,
          memory,
          streamOut,
        )
        totalInputTokens += single.inputTokens
        totalOutputTokens += single.outputTokens
        generated = single.changes
      }
      summary = 'Implement the requested change.'
    } else {
      // Robust path: plan a file manifest, then generate each file on its own — small, validated,
      // retried outputs. This replaces the parallel full-file workers, whose big blobs hit the token
      // cap / returned invalid JSON and were silently discarded (leaving only the tiny files).
      await progress('Planning the files...')
      aiSteps += 1
      const manifest = await planFiles(task.prompt, repoTree, memory)
      totalInputTokens += manifest.inputTokens
      totalOutputTokens += manifest.outputTokens

      if (manifest.files.length === 0) {
        // Manifest planning came back empty (parse miss / sparse model). Rather than dead-end the
        // user, fall back to a single whole-task generation pass — the same call the simple path uses.
        await progress('Generating the project...')
        aiSteps += 1
        const single = await runWorker(
          env.id,
          { role: 'builder', goal: task.prompt, ownedFiles: [], filesToRead: triage.files },
          task.prompt,
          memory,
          streamOut,
        )
        totalInputTokens += single.inputTokens
        totalOutputTokens += single.outputTokens
        generated = single.changes
        summary = 'Build the requested project.'
      } else {
        await assertNotCancelled(taskId)
        await progress(
          `Generating ${manifest.files.length} file${manifest.files.length === 1 ? '' : 's'}...`,
        )
        const gen = await generateFilesInParallel(
          env.id,
          manifest.files,
          task.prompt,
          manifest,
          memory,
          progress,
        )
        aiSteps += gen.attempts
        totalInputTokens += gen.inputTokens
        totalOutputTokens += gen.outputTokens
        generated = gen.files
        filesFailed = gen.failed
        summary = manifest.summary
      }
    }
    }

    await assertNotCancelled(taskId)
    const finalChangesInit = mergeChanges(generated)
    // The agent path applies files as it goes and may legitimately finish with no file changes; only
    // the one-shot pipeline (agentPrior === null) treats "nothing generated" as a failure.
    if (finalChangesInit.length === 0 && agentPrior === null) {
      throw new Error(
        'No files were generated — the model returned empty or invalid output. Please try again.',
      )
    }
    if (filesFailed.length > 0) {
      summary += ` ⚠ ${filesFailed.length} file${filesFailed.length === 1 ? '' : 's'} failed to generate (${filesFailed.join(', ')}).`
    }

    // ── Apply generated files ─────────────────────────────────────────────
    await updateTask(taskId, 'APPLYING')
    // Snapshot pre-task content of changed files for diffing. The agent already wrote its files (and
    // captured their pre-edit content in agentPrior), so reuse that and skip a redundant overwrite.
    const priorContent = new Map<string, string>()
    if (agentPrior) {
      for (const [p, c] of agentPrior) if (c !== null) priorContent.set(p, c)
    } else {
      for (const f of await readWorkspaceFilesParallel(env.id, finalChangesInit.map((c) => c.path))) {
        priorContent.set(f.path, f.content)
      }
      await progress(
        `Writing ${finalChangesInit.length} file${finalChangesInit.length === 1 ? '' : 's'}...`,
      )
      await writeContainerFiles(
        env.id,
        finalChangesInit.map(({ path, content }) => ({ path, content })),
      )
    }

    const changedPaths = new Set(finalChangesInit.map((c) => c.path))
    let finalChanges = finalChangesInit

    // ── Verify + self-heal ────────────────────────────────────────────────
    // Skip verification for a simple edit: the app is (usually) already running and a small change
    // hot-reloads in place. Restarting it + running the full health/self-heal loop is disruptive,
    // slow, and — worse — a false-negative health check would "self-heal" a perfectly working app.
    let health: HealthResult = { healthy: true, portOpen: true, httpStatus: null, log: '', error: null }
    let healthIterations = 0
    if (!isSimple) {
      await assertNotCancelled(taskId)
      await updateTask(taskId, 'VERIFYING')
      await progress('Verifying the app runs...')
      health = await runHealthCheck(env.id, progress)
      const healthDeadline = startedAt + ORCHESTRATION.MAX_TASK_MS
      while (
        !health.healthy &&
        healthIterations < ORCHESTRATION.MAX_HEALTH_ITERATIONS &&
        Date.now() < healthDeadline
      ) {
        await assertNotCancelled(taskId)
        healthIterations += 1
        await progress(
          `Health check failed — self-healing (attempt ${healthIterations}/${ORCHESTRATION.MAX_HEALTH_ITERATIONS})...`,
        )
        const fix = await runFixPass(
          env.id,
          task.prompt,
          { error: health.error ?? 'unknown error', log: health.log },
          [...changedPaths],
        )
        totalInputTokens += fix.inputTokens
        totalOutputTokens += fix.outputTokens
        aiSteps += 1
        if (fix.changes.length === 0) break
        for (const f of await readWorkspaceFilesParallel(env.id, fix.changes.map((c) => c.path))) {
          if (!priorContent.has(f.path)) priorContent.set(f.path, f.content)
        }
        await writeContainerFiles(env.id, fix.changes.map(({ path, content }) => ({ path, content })))
        fix.changes.forEach((c) => changedPaths.add(c.path))
        finalChanges = mergeChanges([...fix.changes, ...finalChanges])
        health = await runHealthCheck(env.id, progress)
      }
    }

    await assertNotCancelled(taskId)

    // ── Assemble result ──────────────────────────────────────────────────
    exploredFiles = allPaths.length
    const enrichedChanges = finalChanges.map((c) => ({
      ...c,
      previousContent: priorContent.get(c.path) ?? null,
    }))
    const healthNote = health.healthy
      ? ''
      : ` ⚠ The app did not pass the health check after ${healthIterations} fix attempt${healthIterations === 1 ? '' : 's'}: ${health.error ?? 'unknown error'}`
    const result: TaskResult = {
      summary: `${summary}${healthNote}`,
      changes: enrichedChanges,
      meta: {
        exploredFiles,
        aiSteps,
        filesGenerated: finalChanges.length,
        filesFailed: filesFailed.length,
        healthIterations,
        healthy: health.healthy,
      },
    }
    let linkedCloneRepositoryUrl: string | undefined

    if (shouldGitAfterCode && gitContext?.accessToken) {
      let remoteUrl = gitContext.cloneRepositoryUrl?.trim() ?? ''
      if (
        intent.gitAction === 'create_repo_push' ||
        (!remoteUrl && intent.gitAction !== 'commit_push')
      ) {
        await updateProgress(taskId, 'Creating GitHub repository...')
        const repoName = intent.repoName ?? projectSlug ?? 'synaro-project'
        const created = await createGithubRepository(gitContext.accessToken, {
          name: repoName,
          private: intent.privateRepo,
          description: 'Created from Synaro',
        })
        remoteUrl = created.cloneRepositoryUrl
        linkedCloneRepositoryUrl = created.cloneRepositoryUrl
        result.git = { action: 'create_repo_push', htmlUrl: created.htmlUrl, remoteUrl }
      }

      if (remoteUrl) {
        const gitOutcome = await runGitPush(
          env.id,
          intent,
          remoteUrl,
          intent.gitAction === 'init_push' || intent.gitAction === 'create_repo_push',
          {
            userPrompt: task.prompt,
            codeSummary: result.summary,
            changedPaths: result.changes.map((c) => c.path),
          },
        )
        result.git = { ...gitOutcome, ...(result.git?.htmlUrl ? { htmlUrl: result.git.htmlUrl } : {}) }
        if (!gitOutcome.noChanges) {
          const subject = gitOutcome.commitMessage?.split('\n')[0] ?? 'changes'
          result.summary = `${result.summary} Pushed to GitHub (${gitOutcome.branch ?? 'main'}): ${subject}.`
        }
      }
    }

    if (linkedCloneRepositoryUrl) {
      result.linkedCloneRepositoryUrl = linkedCloneRepositoryUrl
    }

    // ── Done ──────────────────────────────────────────────────────────────
    await updateTask(taskId, 'DONE', {
      result,
      progress: null,
      streamContent: null,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    })
  } catch (err) {
    if (err instanceof TaskCancelledError || (await isTaskCancelled(taskId))) {
      return
    }
    const errorMessage = formatTaskError(err)
    await updateTask(taskId, 'FAILED', {
      errorMessage,
      progress: null,
      streamContent: null,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    })
    throw err
  }
}
