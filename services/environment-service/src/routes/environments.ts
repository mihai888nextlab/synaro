import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  createEnvironment,
  startEnvironment,
  stopEnvironment,
  destroyEnvironment,
  getContainerStats,
} from '../managers/docker.manager.js'

const createSchema = z.object({
  projectId: z.string().uuid(),
  image: z.string().optional(),
})

export const environmentRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/environments?projectId=xxx
  app.get('/', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    const environments = await prisma.environment.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(environments)
  })

  // GET /api/environments/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const environment = await prisma.environment.findUnique({ where: { id } })
    if (!environment) return reply.status(404).send({ error: 'Environment not found' })
    return reply.send(environment)
  })

  // POST /api/environments — create and start a new environment
  app.post('/', async (req, reply) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })

    try {
      const environment = await createEnvironment(result.data.projectId, result.data.image)
      return reply.status(201).send(environment)
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create environment', detail: String(err) })
    }
  })

  // POST /api/environments/:id/start
  app.post('/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const environment = await startEnvironment(id)
      return reply.send(environment)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to start environment', detail: String(err) })
    }
  })

  // POST /api/environments/:id/stop
  app.post('/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const environment = await stopEnvironment(id)
      return reply.send(environment)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to stop environment', detail: String(err) })
    }
  })

  // GET /api/environments/:id/stats
  app.get('/:id/stats', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const stats = await getContainerStats(id)
      return reply.send(stats)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get stats', detail: String(err) })
    }
  })

  // DELETE /api/environments/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await destroyEnvironment(id)
      return reply.status(204).send()
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to destroy environment', detail: String(err) })
    }
  })
}
