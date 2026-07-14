import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { reloadCronJobs } from '../lib/scheduler.js'

function requireServiceKey(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = process.env.AGENT_SERVICE_KEY?.trim()
  if (key && req.headers['x-service-key'] !== key) {
    reply.status(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

export const cronRoutes: FastifyPluginAsync = async (app) => {
  // Re-read scheduled agents from the DB. Called by agent-service after an agent
  // is created/updated/deleted so schedule changes apply without a restart.
  app.post('/reload', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const count = await reloadCronJobs(app.log)
    return reply.send({ ok: true, scheduled: count })
  })
}
