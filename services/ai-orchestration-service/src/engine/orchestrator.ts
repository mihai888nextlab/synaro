import { kimi, MODELS, TOKEN_BUDGETS } from '../lib/kimi.js'
import {
  listProjectFiles,
  readFiles,
  applyFileChanges,
  buildRepoTree,
} from '../lib/filesystem.js'
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
  repoTree: string
): Promise<{ files: string[]; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `You are a code analysis assistant. Given a repository file tree and a user task, 
return ONLY a JSON array of file paths that are relevant to completing the task.
Be selective — return only the files that need to be read or modified.
Return format: { "files": ["path/to/file.ts", ...] }
Return ONLY valid JSON, no explanation.`

  const userPrompt = `Task: ${prompt}\n\nRepository files:\n${repoTree}`

  const response = await kimi.chat.completions.create({
    model: MODELS.ANALYZE,
    max_tokens: 500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())
  const files: string[] = parsed.files ?? []

  return {
    files,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

// Step 2 — targeted call to generate code changes
async function generateChanges(
  prompt: string,
  fileContents: { path: string; content: string }[]
): Promise<{ result: TaskResult; inputTokens: number; outputTokens: number }> {
  const systemPrompt = `You are an expert software engineer. Given a task and relevant source files, 
produce the necessary file changes to complete the task.

Return ONLY a JSON object in this exact format:
{
  "summary": "Brief description of what was changed",
  "changes": [
    {
      "path": "relative/path/to/file.ts",
      "content": "full new file content here"
    }
  ]
}

Rules:
- Always return the FULL file content, not just the changed parts
- Only include files that actually need to change
- Keep changes minimal and focused on the task
- Return ONLY valid JSON, no explanation outside the JSON`

  const filesSection = fileContents
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const userPrompt = `Task: ${prompt}\n\nRelevant files:\n\n${filesSection}`

  const response = await kimi.chat.completions.create({
    model: MODELS.GENERATE,
    max_tokens: TOKEN_BUDGETS.MAX_OUTPUT,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())

  return {
    result: {
      summary: parsed.summary ?? '',
      changes: parsed.changes ?? [],
    },
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  }
}

// Main orchestration function
export async function executeTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    // Step 1 — Analyze
    await updateTask(taskId, 'ANALYZING')

    const allFiles = await listProjectFiles(task.projectId)
    const repoTree = buildRepoTree(allFiles)

    const analysis = await analyzeRelevantFiles(task.prompt, repoTree)
    totalInputTokens += analysis.inputTokens
    totalOutputTokens += analysis.outputTokens

    // Step 2 — Read relevant files
    const relevantFiles = await readFiles(task.projectId, analysis.files)

    // Step 3 — Generate changes
    await updateTask(taskId, 'GENERATING')

    const generation = await generateChanges(task.prompt, relevantFiles)
    totalInputTokens += generation.inputTokens
    totalOutputTokens += generation.outputTokens

    // Step 4 — Apply changes
    await updateTask(taskId, 'APPLYING')
    await applyFileChanges(task.projectId, generation.result.changes)

    // Step 5 — Done
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
