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
import { planWork } from './planner.js'
import { runWorkersInParallel, runFixPass } from './worker.js'
import { integrate } from './integrator.js'
import { runHealthCheck } from './health-check.js'
import { mergeChanges } from './parse-changes.js'
import { prisma } from '../lib/prisma.js'

type TaskStatus = 'PENDING' | 'ANALYZING' | 'GENERATING' | 'APPLYING' | 'VERIFYING' | 'DONE' | 'FAILED'

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
    /** Role-workers dispatched by the planner. */
    workers?: number
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
  return prisma.task.update({ where: { id }, data: { status, ...extra } })
}

async function updateProgress(id: string, progress: string) {
  return prisma.task.update({ where: { id }, data: { progress } })
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
      await updateProgress(taskId, msg)
    }

    // ── Memory: replay recent tasks so follow-ups build on prior work ─────
    const memory = await loadRecentTaskContext(task.projectId, taskId)

    // ── Scan workspace + plan the work into disjoint-ownership workers ────
    await progress('Scanning your repository...')
    const allPaths = await listContainerFiles(env.id)
    const repoTree = buildRepoTree(allPaths.map((p) => ({ path: p, size: 0 })))

    await progress('Planning the work...')
    aiSteps += 1
    const planned = await planWork(task.prompt, repoTree, memory)
    totalInputTokens += planned.inputTokens
    totalOutputTokens += planned.outputTokens
    const plan = planned.plan

    // ── Workers run in parallel on their owned files ─────────────────────
    await updateTask(taskId, 'GENERATING', { streamContent: null })
    await progress(
      `Dispatching ${plan.workers.length} worker${plan.workers.length === 1 ? '' : 's'} (${plan.workers
        .map((w) => w.role)
        .join(', ')})...`,
    )
    const workerOutputs = await runWorkersInParallel(env.id, plan.workers, task.prompt, memory, progress)
    aiSteps += plan.workers.length
    for (const w of workerOutputs) {
      totalInputTokens += w.inputTokens
      totalOutputTokens += w.outputTokens
    }

    const workerChanges = mergeChanges(workerOutputs.flatMap((w) => w.changes))
    if (workerChanges.length === 0) {
      throw new Error(
        'The workers did not produce any file changes. The response may have been empty or malformed. ' +
          'Please try again with a more specific prompt.',
      )
    }

    // ── Apply worker output, then integrate (wire the modules together) ──
    await updateTask(taskId, 'APPLYING')
    // Snapshot pre-task content of changed files for diffing before overwriting.
    const priorContent = new Map<string, string>()
    for (const f of await readWorkspaceFilesParallel(env.id, workerChanges.map((c) => c.path))) {
      priorContent.set(f.path, f.content)
    }
    await progress(`Writing ${workerChanges.length} file${workerChanges.length === 1 ? '' : 's'}...`)
    await writeContainerFiles(env.id, workerChanges.map(({ path, content }) => ({ path, content })))

    const changedPaths = new Set(workerChanges.map((c) => c.path))
    const allPathsAfter = Array.from(new Set([...allPaths, ...changedPaths]))

    await progress('Integrating modules...')
    aiSteps += 1
    const integration = await integrate(env.id, task.prompt, plan, [...changedPaths], allPathsAfter)
    totalInputTokens += integration.inputTokens
    totalOutputTokens += integration.outputTokens
    if (integration.changes.length > 0) {
      for (const f of await readWorkspaceFilesParallel(env.id, integration.changes.map((c) => c.path))) {
        if (!priorContent.has(f.path)) priorContent.set(f.path, f.content)
      }
      await writeContainerFiles(env.id, integration.changes.map(({ path, content }) => ({ path, content })))
      integration.changes.forEach((c) => changedPaths.add(c.path))
    }
    let finalChanges = mergeChanges([...integration.changes, ...workerChanges])

    // ── Health check + self-heal loop ────────────────────────────────────
    await updateTask(taskId, 'VERIFYING')
    await progress('Verifying the app runs...')
    let health = await runHealthCheck(env.id, progress)
    let healthIterations = 0
    while (!health.healthy && healthIterations < ORCHESTRATION.MAX_HEALTH_ITERATIONS) {
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
      summary: `${plan.summary}${healthNote}`,
      changes: enrichedChanges,
      meta: {
        exploredFiles,
        aiSteps,
        workers: plan.workers.length,
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
