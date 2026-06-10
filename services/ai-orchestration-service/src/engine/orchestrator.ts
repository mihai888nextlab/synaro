import { kimi, MODELS, TOKEN_BUDGETS } from '../lib/kimi.js'
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
import { prisma } from '../lib/prisma.js'

type TaskStatus = 'PENDING' | 'ANALYZING' | 'GENERATING' | 'APPLYING' | 'DONE' | 'FAILED'

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
    /** Number of workspace files successfully read for this task. */
    exploredFiles: number
    /** Approximate number of AI calls made (analysis + generation passes). */
    aiSteps: number
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

// Step 2 — generate all file changes needed for the task
async function generateChanges(
  prompt: string,
  existingFiles: { path: string; content: string }[],
  taskId?: string,
): Promise<{ result: TaskResult; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `You are an expert software engineer. Given a task and the current source files, produce all necessary file changes to complete the task — including new files.

Return ONLY a JSON object in this exact format:
{
  "summary": "One-sentence description of what was done",
  "changes": [
    {
      "path": "relative/path/to/file.ts",
      "content": "full file content"
    }
  ]
}

Rules:
- Always return the FULL file content for every changed or created file (never null or omit content)
- Every item in changes must have path (string) and content (string)
- Create new files when needed (routes, modules, components, etc.)
- Include all files required for the feature to work end-to-end
- Wire new code into existing entry points (index.ts, app.ts, router, etc.) when needed
- Return ONLY valid JSON — no explanation outside the JSON block
- For Next.js projects: do NOT set distDir in next.config.js/mjs (always use the default .next); do NOT set output: 'export' or output: 'standalone'; always include a dev script ("next dev") in package.json; the app must bind to process.env.PORT (default 3000)`

  const filesSection =
    existingFiles.length > 0
      ? existingFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : '(no existing files yet — this is a new project)'

  const userPrompt = `Task: ${prompt}\n\nExisting files:\n\n${filesSection}`
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ]

  let raw: string
  let finishReason: string | null | undefined
  let inputTokens = 0
  let outputTokens = 0

  if (taskId) {
    const streamed = await streamKimiChatCompletion({
      taskId,
      messages,
      maxTokens: TOKEN_BUDGETS.MAX_OUTPUT,
    })
    raw = streamed.content || '{}'
    inputTokens = streamed.inputTokens
    outputTokens = streamed.outputTokens
    finishReason = streamed.finishReason
  } else {
    const response = await kimi.chat.completions.create({
      model: MODELS.GENERATE,
      max_tokens: TOKEN_BUDGETS.MAX_OUTPUT,
      messages,
    })
    raw = response.choices[0]?.message?.content ?? '{}'
    finishReason = response.choices[0]?.finish_reason
    inputTokens = response.usage?.prompt_tokens ?? 0
    outputTokens = response.usage?.completion_tokens ?? 0
  }

  let parsed: { summary?: string; changes?: FileChange[] } = {}
  let parseError: string | null = null
  try {
    // Strip potential markdown code fences around the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch (e) {
    parseError = String(e)
  }

  if (finishReason === 'length') {
    throw new Error(
      `AI response was cut off (output token limit reached at ${TOKEN_BUDGETS.MAX_OUTPUT} tokens). ` +
        'The generated project is too large for a single pass. Try a simpler prompt or fewer features.',
    )
  }

  if (parseError) {
    throw new Error(`AI returned invalid JSON — could not parse file changes. Parse error: ${parseError}`)
  }

  const changes = (parsed.changes ?? [])
    .filter(
      (c): c is FileChange =>
        Boolean(c) &&
        typeof c.path === 'string' &&
        c.path.trim().length > 0 &&
        typeof c.content === 'string',
    )
    .map((c) => ({ path: c.path.trim(), content: c.content }))

  return {
    result: {
      summary: parsed.summary ?? 'Changes applied.',
      changes,
    },
    inputTokens,
    outputTokens,
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

    // ── Step 2: List all workspace files ─────────────────────────────────
    await updateProgress(taskId, 'Scanning your repository...')
    const allPaths = await listContainerFiles(env.id)
    const repoTree = buildRepoTree(allPaths.map((p) => ({ path: p, size: 0 })))
    await updateProgress(taskId, `Found ${allPaths.length} file${allPaths.length === 1 ? '' : 's'} — identifying relevant ones...`)

    // ── Step 3: Identify relevant files ──────────────────────────────────
    aiSteps += 1
    const analysis = await analyzeRelevantFiles(task.prompt, repoTree)
    totalInputTokens += analysis.inputTokens
    totalOutputTokens += analysis.outputTokens

    // ── Step 4: Read relevant files in parallel ───────────────────────────
    // Hard safety: even if upstream returns malformed shapes, never allow a non-array here.
    const relevantFiles: string[] = Array.isArray((analysis as any).files)
      ? ((analysis as any).files as unknown[]).filter((f): f is string => typeof f === 'string')
      : analysis.files
    const fileCount = relevantFiles.length
    await updateProgress(
      taskId,
      fileCount > 0
        ? `Reading ${fileCount} relevant file${fileCount === 1 ? '' : 's'}...`
        : 'No existing files — starting from scratch...',
    )
    const fileContents = await Promise.all(
      relevantFiles.map(async (filePath) => {
        const content = await readContainerFile(env.id, filePath)
        return content !== null ? { path: filePath, content } : null
      }),
    )
    const existingFiles = fileContents.filter((f): f is { path: string; content: string } => f !== null)
    exploredFiles += existingFiles.length

    // ── Step 5: Generate changes ─────────────────────────────────────────
    await updateTask(taskId, 'GENERATING', { streamContent: null })
    await updateProgress(taskId, 'AI is writing your code...')

    aiSteps += 1
    const generation = await generateChanges(task.prompt, existingFiles, taskId)
    totalInputTokens += generation.inputTokens
    totalOutputTokens += generation.outputTokens

    // ── Step 6: Write files into the container ────────────────────────────
    await updateTask(taskId, 'APPLYING')

    if (generation.result.changes.length === 0) {
      throw new Error(
        'AI did not produce any file changes. The response may have been empty or malformed. ' +
          'Please try again with a more specific prompt.',
      )
    }

    const existingByPath = new Map(existingFiles.map((f) => [f.path, f.content]))
    const enrichedChanges = generation.result.changes.map((c) => ({
      ...c,
      previousContent: existingByPath.get(c.path) ?? null,
    }))

    const changeCount = enrichedChanges.length
    await updateProgress(taskId, `Writing ${changeCount} file${changeCount === 1 ? '' : 's'} to your project...`)
    await writeContainerFiles(
      env.id,
      enrichedChanges.map(({ path, content }) => ({ path, content })),
    )

    const result: TaskResult = {
      ...generation.result,
      changes: enrichedChanges,
      meta: { exploredFiles, aiSteps },
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
