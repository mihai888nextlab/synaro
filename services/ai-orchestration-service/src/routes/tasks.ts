import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { executeTask } from '../engine/orchestrator.js'
import { kimi, MODELS } from '../lib/kimi.js'
import type { TaskGitContext } from '../lib/task-intent.js'

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  projectSlug: z.string().min(1).max(80).optional(),
  git: z
    .object({
      accessToken: z.string().min(1),
      cloneRepositoryUrl: z.union([z.string().url(), z.null()]).optional(),
      authorName: z.string().min(1).max(120),
      authorEmail: z.string().email().max(200),
    })
    .optional(),
})

export const taskRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/tasks/clarify — ask clarifying questions before generation
  // Defined before /:id routes so Fastify resolves the literal path first
  app.post('/clarify', async (req, reply) => {
    const { prompt } = req.body as { prompt?: string }
    if (!prompt?.trim()) {
      return reply.status(400).send({ error: 'prompt is required' })
    }

    try {
      const response = await kimi.chat.completions.create({
        model: MODELS.ANALYZE,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI coding assistant. When a user asks you to build something, ask 2–3 short, specific clarifying questions to better understand their requirements before you start.

Focus on: specific features/pages they need, design or color preferences, any tech constraints or preferences.

Return ONLY valid JSON — no explanation: {"questions": ["...", "...", "..."]}

If the request is already very detailed and specific, return: {"questions": []}`,
          },
          { role: 'user', content: prompt },
        ],
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      let parsed: { questions?: string[] } = {}
      try {
        parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()) as typeof parsed
      } catch {
        parsed = {}
      }

      return reply.send({ questions: parsed.questions ?? [] })
    } catch (err) {
      app.log.error(err, 'Clarify call failed')
      return reply.send({ questions: [] })
    }
  })

  // GET /api/tasks?projectId=xxx
  app.get('/', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    const tasks = await prisma.task.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(tasks)
  })

  // GET /api/tasks/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return reply.status(404).send({ error: 'Task not found' })
    return reply.send(task)
  })

  // POST /api/tasks — create task and execute asynchronously
  app.post('/', async (req, reply) => {
    const result = createTaskSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten() })
    }

    const task = await prisma.task.create({
      data: {
        projectId: result.data.projectId,
        prompt: result.data.prompt,
        status: 'PENDING',
      },
    })

    const gitContext: TaskGitContext | undefined = result.data.git
      ? {
          accessToken: result.data.git.accessToken,
          cloneRepositoryUrl: result.data.git.cloneRepositoryUrl ?? null,
          authorName: result.data.git.authorName,
          authorEmail: result.data.git.authorEmail,
        }
      : undefined

    // Execute asynchronously — don't await, return task ID immediately (git token never persisted)
    executeTask(task.id, {
      gitContext,
      projectSlug: result.data.projectSlug,
    }).catch((err) => {
      app.log.error({ taskId: task.id, err }, 'Task execution failed')
    })

    return reply.status(202).send(task)
  })
}
