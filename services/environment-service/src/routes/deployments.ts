import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  deployProject,
  getDeployment,
  stopDeployment,
  startDeployment,
  destroyDeployment,
  getDeployLogs,
  reconcileDeployment,
  deployPublicUrl,
} from '../managers/deploy.manager.js'

const deploySchema = z.object({
  projectId: z.string().uuid(),
  projectSlug: z.string().min(1).max(80),
  commitSha: z.string().min(1).max(64).optional(),
})

/** Attach the computed public URL to a deployment row before sending to clients. */
function withPublicUrl<T extends { subdomain?: string | null }>(dep: T | null) {
  if (!dep) return null
  return { ...dep, publicUrl: deployPublicUrl(dep) }
}

export const deploymentRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/deployments — start (or re-run) a production deployment. Returns 202 while BUILDING.
  app.post('/', async (req, reply) => {
    const result = deploySchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })
    try {
      const dep = await deployProject(result.data.projectId, {
        projectSlug: result.data.projectSlug,
        commitSha: result.data.commitSha ?? null,
      })
      return reply.status(202).send(withPublicUrl(dep))
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Failed to start deployment', detail: String(err) })
    }
  })

  // GET /api/deployments/:projectId — current deployment status (reconciles stale RUNNING rows first).
  app.get('/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    await reconcileDeployment(projectId).catch(() => {})
    const dep = await getDeployment(projectId)
    if (!dep) return reply.status(404).send({ error: 'No deployment found' })
    return reply.send(withPublicUrl(dep))
  })

  // GET /api/deployments/:projectId/logs — last 200 lines of the build/run log.
  app.get('/:projectId/logs', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const lines = await getDeployLogs(projectId)
    return reply.send({ lines })
  })

  // POST /api/deployments/:projectId/stop
  app.post('/:projectId/stop', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      const dep = await stopDeployment(projectId)
      return reply.send(withPublicUrl(dep))
    } catch (err) {
      const msg = String(err)
      if (msg.includes('No deployment')) return reply.status(404).send({ error: msg })
      return reply.status(500).send({ error: 'Failed to stop deployment', detail: msg })
    }
  })

  // POST /api/deployments/:projectId/start
  app.post('/:projectId/start', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      const dep = await startDeployment(projectId)
      return reply.send(withPublicUrl(dep))
    } catch (err) {
      const msg = String(err)
      if (msg.includes('No deployment')) return reply.status(404).send({ error: msg })
      return reply.status(500).send({ error: 'Failed to start deployment', detail: msg })
    }
  })

  // DELETE /api/deployments/:projectId — stop + remove container, volume and row.
  app.delete('/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    try {
      await destroyDeployment(projectId)
      return reply.status(204).send()
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to destroy deployment', detail: String(err) })
    }
  })
}
