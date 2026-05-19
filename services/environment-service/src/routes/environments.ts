import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import {
  createEnvironment,
  startEnvironment,
  stopEnvironment,
  destroyEnvironment,
  getContainerStats,
  listWorkspaceFilePaths,
  getWorkspaceSelection,
  reconcileDeadContainersForProject,
  uploadWorkspaceTar,
  execTerminalCommand,
} from '../managers/docker.manager.js'

const terminalExecSchema = z.object({
  command: z.string().max(8000),
})

const createSchema = z.object({
  projectId: z.string().uuid(),
  image: z.string().optional(),
  gitRemoteUrl: z
    .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.string().url().optional()),
  gitAccessToken: z
    .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.string().min(1).optional()),
})

export const environmentRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 52_428_800 },
    (_req, body, done) => {
      done(null, body)
    },
  )

  // GET /api/environments?projectId=xxx
  app.get('/', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    if (projectId) {
      try {
        await reconcileDeadContainersForProject(projectId)
      } catch (err) {
        app.log.warn({ err, projectId }, 'reconcileDeadContainersForProject skipped')
      }
    }
    const environments = await prisma.environment.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(environments)
  })

  // GET /api/environments/:id/workspace-files — list files in cloned repo (Docker exec)
  app.get('/:id/workspace-files', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const result = await listWorkspaceFilePaths(id)
      return reply.send(result)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('not active')) return reply.status(409).send({ error: msg })
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to list workspace files', detail: msg })
    }
  })

  // POST /api/environments/:id/terminal — run a shell command in the container workspace
  app.post('/:id/terminal', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = terminalExecSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Body must include command (string)' })
    }
    try {
      const result = await execTerminalCommand(id, parsed.data.command)
      return reply.send(result)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('not active') || msg.includes('not running')) {
        return reply.status(409).send({ error: msg })
      }
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      if (msg.includes('too long')) return reply.status(400).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to run command', detail: msg })
    }
  })

  // GET /api/environments/:id/workspace-selection?path= — file/dir preview + git log (Docker exec)
  app.get('/:id/workspace-selection', async (req, reply) => {
    const { id } = req.params as { id: string }
    const q = req.query as { path?: string }
    const rawPath = typeof q.path === 'string' ? q.path : ''
    if (!rawPath.trim()) {
      return reply.status(400).send({ error: 'Missing path query parameter' })
    }
    try {
      const result = await getWorkspaceSelection(id, rawPath)
      return reply.send(result)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('Invalid path')) return reply.status(400).send({ error: msg })
      if (msg.includes('not active')) return reply.status(409).send({ error: msg })
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to read workspace selection', detail: msg })
    }
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
      const environment = await createEnvironment(result.data.projectId, result.data.image ?? 'node:20-alpine', {
        gitRemoteUrl: result.data.gitRemoteUrl,
        gitAccessToken: result.data.gitAccessToken,
      })
      return reply.status(201).send(environment)
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create environment', detail: String(err) })
    }
  })

  // POST /api/environments/:id/workspace-upload — raw tar body (internal; Next.js proxies from folder import)
  app.post('/:id/workspace-upload', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Buffer | undefined
    if (!body || !Buffer.isBuffer(body) || body.length === 0) {
      return reply.status(400).send({ error: 'Expected non-empty application/octet-stream body (tar).' })
    }
    try {
      await uploadWorkspaceTar(id, body)
      return reply.status(204).send()
    } catch (err) {
      const msg = String(err)
      if (msg.includes('not active')) return reply.status(409).send({ error: msg })
      if (msg.includes('not running')) return reply.status(409).send({ error: msg })
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to upload workspace archive', detail: msg })
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
