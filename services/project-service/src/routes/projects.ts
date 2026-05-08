import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  userId: z.string().uuid(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  repositoryLocation: z.string().optional(),
  environmentStatus: z
    .enum(['INACTIVE', 'PROVISIONING', 'RUNNING', 'STOPPED', 'ERROR'])
    .optional(),
})

export const projectRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/projects?userId=xxx
  app.get('/', async (req, reply) => {
    const { userId } = req.query as { userId?: string }

    const projects = await prisma.project.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return reply.send(projects)
  })

  // GET /api/projects/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    return reply.send(project)
  })

  // POST /api/projects
  app.post('/', async (req, reply) => {
    const result = createProjectSchema.safeParse(req.body)

    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten() })
    }

    const { name, description, userId } = result.data

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const project = await prisma.project.create({
      data: { name, description, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return reply.status(201).send(project)
  })

  // PATCH /api/projects/:id
  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const result = updateProjectSchema.safeParse(req.body)

    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten() })
    }

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const project = await prisma.project.update({
      where: { id },
      data: result.data,
    })

    return reply.send(project)
  })

  // DELETE /api/projects/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    await prisma.project.delete({ where: { id } })

    return reply.status(204).send()
  })
}