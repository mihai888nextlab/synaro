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
  writeWorkspaceFile,
  reconcileDeadContainersForProject,
  uploadWorkspaceTar,
  exportWorkspaceTarGzip,
  execTerminalCommand,
  gitCommitAndPushWorkspace,
  getGitWorkspaceChangesSummary,
  envPublicUrl,
} from '../managers/docker.manager.js'

const terminalExecSchema = z.object({
  command: z.string().max(8000),
})

const gitPushSchema = z.object({
  accessToken: z.string().min(1),
  gitRemoteUrl: z.string().url(),
  commitMessage: z.string().min(1).max(4000),
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(200),
  initIfNeeded: z.boolean().optional(),
})

const createSchema = z.object({
  projectId: z.string().uuid(),
  image: z.string().optional(),
  gitRemoteUrl: z
    .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.string().url().optional()),
  gitAccessToken: z
    .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.string().min(1).optional()),
  projectSlug: z
    .preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.string().min(1).max(80).optional()),
})

/** Attach the computed public URL to an environment row before sending to clients. */
function withPublicUrl<T extends { subdomain?: string | null; port?: number | null }>(env: T) {
  return { ...env, publicUrl: envPublicUrl(env) }
}

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
    return reply.send(environments.map(withPublicUrl))
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

  // GET /api/environments/:id/git/changes-summary — status + diff for commit message generation
  app.get('/:id/git/changes-summary', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const summary = await getGitWorkspaceChangesSummary(id)
      return reply.send({ summary })
    } catch (err) {
      const msg = String(err)
      if (msg.includes('not active') || msg.includes('not running')) {
        return reply.status(409).send({ error: msg })
      }
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to read git changes', detail: msg })
    }
  })

  // POST /api/environments/:id/git/push — commit all workspace changes and push to GitHub
  app.post('/:id/git/push', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = gitPushSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid git push payload', details: parsed.error.flatten() })
    }
    try {
      const result = await gitCommitAndPushWorkspace(id, parsed.data)
      if (!result.ok) {
        return reply.status(422).send({ error: 'Git push failed', ...result })
      }
      return reply.send(result)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('not active') || msg.includes('not running')) {
        return reply.status(409).send({ error: msg })
      }
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to run git push', detail: msg })
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

  // PUT /api/environments/:id/workspace-file — write a file into the container workspace
  app.put('/:id/workspace-file', async (req, reply) => {
    const { id } = req.params as { id: string }
    const writeFileSchema = z.object({
      path: z.string().min(1).max(4096),
      content: z.string().max(2_000_000),
    })
    const body = writeFileSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid request body' })
    try {
      await writeWorkspaceFile(id, body.data.path, body.data.content)
      return reply.send({ ok: true })
    } catch (err) {
      const msg = String(err)
      if (msg.includes('Invalid path')) return reply.status(400).send({ error: msg })
      if (msg.includes('not active')) return reply.status(409).send({ error: msg })
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to write file', detail: msg })
    }
  })

  // GET /api/environments/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const environment = await prisma.environment.findUnique({ where: { id } })
    if (!environment) return reply.status(404).send({ error: 'Environment not found' })
    return reply.send(withPublicUrl(environment))
  })

  // POST /api/environments — create and start a new environment
  app.post('/', async (req, reply) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })

    try {
      const environment = await createEnvironment(result.data.projectId, result.data.image ?? 'node:20-alpine', {
        gitRemoteUrl: result.data.gitRemoteUrl,
        gitAccessToken: result.data.gitAccessToken,
        projectSlug: result.data.projectSlug,
      })
      return reply.status(201).send(withPublicUrl(environment))
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to create environment', detail: String(err) })
    }
  })

  // GET /api/environments/:id/workspace-download — gzip tar of workspace (internal; Next.js proxies to browser)
  app.get('/:id/workspace-download', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const stream = await exportWorkspaceTarGzip(id)
      return reply
        .header('Content-Type', 'application/gzip')
        .header('Content-Disposition', 'attachment; filename="workspace.tar.gz"')
        .send(stream)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('must be running') || msg.includes('not running') || msg.includes('not active')) {
        return reply.status(409).send({ error: msg })
      }
      if (msg.includes('too large')) return reply.status(413).send({ error: msg })
      if (msg.includes('No container')) return reply.status(404).send({ error: msg })
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to export workspace', detail: msg })
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
      return reply.send(withPublicUrl(environment))
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to start environment', detail: String(err) })
    }
  })

  // POST /api/environments/:id/stop
  app.post('/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      const environment = await stopEnvironment(id)
      return reply.send(withPublicUrl(environment))
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to stop environment', detail: String(err) })
    }
  })

  // POST /api/environments/:id/custom-domain — set or clear the custom domain for an environment
  app.post('/:id/custom-domain', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { customDomain } = req.body as { customDomain?: string }
    const domain = typeof customDomain === 'string' ? customDomain.trim().toLowerCase() : null

    try {
      const environment = await prisma.environment.update({
        where: { id },
        data: { customDomain: domain || null },
      })
      return reply.send({
        ...withPublicUrl(environment),
        customDomain: environment.customDomain,
        instructions: domain
          ? `Point a CNAME record for ${domain} → ${process.env.SYNARO_DOMAIN ?? 'your-vps-domain'}. SSL will be provisioned automatically.`
          : null,
      })
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to update custom domain', detail: String(err) })
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
