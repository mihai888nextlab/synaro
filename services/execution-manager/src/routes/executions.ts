import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  createExecution,
  stopExecution,
  destroyExecution,
  getExecutionLogs,
} from '../managers/execution.manager.js'

const createSchema = z.object({
  projectId: z.string(),
  port: z.number().int().min(1024).max(65535),
})

export const executionRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/executions
  app.post('/', async (req, reply) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })

    try {
      const execution = await createExecution(result.data.projectId, result.data.port)
      return reply.status(201).send(execution)
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create execution', detail: String(err) })
    }
  })

  // GET /api/executions?projectId=xxx
  app.get('/', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    const executions = await prisma.execution.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(executions)
  })

  // GET /api/executions/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const execution = await prisma.execution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })
    return reply.send(execution)
  })

  // POST /api/executions/:id/stop
  app.post('/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const execution = await stopExecution(id)
      return reply.send(execution)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to stop execution', detail: String(err) })
    }
  })

  // GET /api/executions/:id/logs
  app.get('/:id/logs', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const result = await getExecutionLogs(id)
      return reply.send(result)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get logs', detail: String(err) })
    }
  })

  // DELETE /api/executions/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await destroyExecution(id)
      return reply.status(204).send()
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to delete execution', detail: String(err) })
    }
  })
}
