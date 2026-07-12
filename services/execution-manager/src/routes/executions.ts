import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  createProjectDeployment,
  destroyProjectDeployment,
  getProjectLogs,
  startProjectDeployment,
  stopProjectDeployment,
} from '../managers/k8s.manager.js'

const createSchema = z.object({
  projectId: z.string().min(1),
})

export const executionRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/executions — create a K8s Deployment + Service + Ingress for a project
  app.post('/', async (req, reply) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })

    const { projectId } = result.data
    const execution = await prisma.execution.create({
      data: { projectId, status: 'STARTING' },
    })

    try {
      const { subdomain } = await createProjectDeployment(projectId)
      const updated = await prisma.execution.update({
        where: { id: execution.id },
        data: { status: 'RUNNING', subdomain, containerId: null, startedAt: new Date() },
      })
      return reply.status(201).send(updated)
    } catch (err) {
      app.log.error(err)
      await prisma.execution.update({ where: { id: execution.id }, data: { status: 'ERROR' } })
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

  // POST /api/executions/:id/stop — scale the deployment to 0
  app.post('/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string }
    const execution = await prisma.execution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    try {
      await stopProjectDeployment(execution.projectId)
      const updated = await prisma.execution.update({
        where: { id },
        data: { status: 'STOPPED', stoppedAt: new Date() },
      })
      return reply.send(updated)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to stop execution', detail: String(err) })
    }
  })

  // POST /api/executions/:id/start — scale the deployment back to 1
  app.post('/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string }
    const execution = await prisma.execution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    try {
      await startProjectDeployment(execution.projectId)
      const updated = await prisma.execution.update({
        where: { id },
        data: { status: 'RUNNING', startedAt: new Date() },
      })
      return reply.send(updated)
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to start execution', detail: String(err) })
    }
  })

  // GET /api/executions/:id/logs
  app.get('/:id/logs', async (req, reply) => {
    const { id } = req.params as { id: string }
    const execution = await prisma.execution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    try {
      const logs = await getProjectLogs(execution.projectId)
      return reply.send({ logs })
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to get logs', detail: String(err) })
    }
  })

  // DELETE /api/executions/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const execution = await prisma.execution.findUnique({ where: { id } })
    if (!execution) return reply.status(404).send({ error: 'Execution not found' })

    try {
      await destroyProjectDeployment(execution.projectId)
      await prisma.execution.delete({ where: { id } })
      return reply.status(204).send()
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to delete execution', detail: String(err) })
    }
  })
}
