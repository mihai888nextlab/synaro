import { kimi, MODELS, TOKEN_BUDGETS } from '../lib/kimi.js'
import { buildRepoTree } from '../lib/filesystem.js'
import {
  getActiveEnvironment,
  listContainerFiles,
  readContainerFile,
  writeContainerFiles,
} from '../lib/environment-client.js'
import { prisma } from '../lib/prisma.js'

type TaskStatus = 'PENDING' | 'ANALYZING' | 'GENERATING' | 'APPLYING' | 'DONE' | 'FAILED'

interface FileChange {
  path: string
  content: string
}

interface TaskResult {
  changes: FileChange[]
  summary: string
}

async function updateTask(id: string, status: TaskStatus, extra?: object) {
  return prisma.task.update({ where: { id }, data: { status, ...extra } })
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
  let parsed: { files?: string[] } = {}
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { files?: string[] }
  } catch {
    parsed = {}
  }

  return {
    files: parsed.files ?? [],
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

// Step 2 — generate all file changes needed for the task
async function generateChanges(
  prompt: string,
  existingFiles: { path: string; content: string }[],
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
- Always return the FULL file content for every changed or created file
- Create new files when needed (routes, modules, components, etc.)
- Include all files required for the feature to work end-to-end
- Wire new code into existing entry points (index.ts, app.ts, router, etc.) when needed
- Return ONLY valid JSON — no explanation outside the JSON block`

  const filesSection =
    existingFiles.length > 0
      ? existingFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : '(no existing files yet — this is a new project)'

  const userPrompt = `Task: ${prompt}\n\nExisting files:\n\n${filesSection}`

  const response = await kimi.chat.completions.create({
    model: MODELS.GENERATE,
    max_tokens: TOKEN_BUDGETS.MAX_OUTPUT,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: { summary?: string; changes?: FileChange[] } = {}
  try {
    // Strip potential markdown code fences around the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch {
    parsed = {}
  }

  return {
    result: {
      summary: parsed.summary ?? 'Changes applied.',
      changes: parsed.changes ?? [],
    },
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

/** Main orchestration function — reads from and writes to the running environment container. */
export async function executeTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  let totalInputTokens = 0
  let totalOutputTokens = 0

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

    // ── Step 2: List all workspace files ─────────────────────────────────
    const allPaths = await listContainerFiles(env.id)
    const repoTree = buildRepoTree(allPaths.map((p) => ({ path: p, size: 0 })))

    // ── Step 3: Identify relevant files ──────────────────────────────────
    const analysis = await analyzeRelevantFiles(task.prompt, repoTree)
    totalInputTokens += analysis.inputTokens
    totalOutputTokens += analysis.outputTokens

    // ── Step 4: Read relevant files in parallel ───────────────────────────
    const fileContents = await Promise.all(
      analysis.files.map(async (filePath) => {
        const content = await readContainerFile(env.id, filePath)
        return content !== null ? { path: filePath, content } : null
      }),
    )
    const existingFiles = fileContents.filter((f): f is { path: string; content: string } => f !== null)

    // ── Step 5: Generate changes ─────────────────────────────────────────
    await updateTask(taskId, 'GENERATING')

    const generation = await generateChanges(task.prompt, existingFiles)
    totalInputTokens += generation.inputTokens
    totalOutputTokens += generation.outputTokens

    // ── Step 6: Write files into the container ────────────────────────────
    await updateTask(taskId, 'APPLYING')
    await writeContainerFiles(env.id, generation.result.changes)

    // ── Done ──────────────────────────────────────────────────────────────
    await updateTask(taskId, 'DONE', {
      result: generation.result,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    })
  } catch (err) {
    await updateTask(taskId, 'FAILED', {
      errorMessage: String(err),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    })
    throw err
  }
}
