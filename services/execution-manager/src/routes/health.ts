import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { MOCK_K8S, k8sCoreApi } from '../lib/k8s.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    // Database is required; a failure here is a hard 503.
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (err) {
      return reply.status(503).send({ status: 'error', database: 'disconnected', error: String(err) })
    }

    // Kubernetes connectivity is reported but not fatal (reflects reachability).
    let kubernetes: 'connected' | 'disconnected' | 'mock' = 'mock'
    if (!MOCK_K8S) {
      try {
        await k8sCoreApi!.listNamespace()
        kubernetes = 'connected'
      } catch {
        kubernetes = 'disconnected'
      }
    }

    return reply.send({ status: 'ok', database: 'connected', kubernetes })
  })
}
