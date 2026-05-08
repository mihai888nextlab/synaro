import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { executeTask } from '../engine/orchestrator.js'

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
})

export const taskRoutes: FastifyPluginAsync = async (app) => {
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

    // Execute asynchronously — don't await, return task ID immediately
    executeTask(task.id).catch((err) => {
      app.log.error({ taskId: task.id, err }, 'Task execution failed')
    })

    return reply.status(202).send(task)
  })
}
