import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { kimi } from '../lib/kimi.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`

      // Verify Kimi API key is set
      const kimiOk = Boolean(process.env.KIMI_API_KEY)

      return reply.send({
        status: 'ok',
        database: 'connected',
        kimi: kimiOk ? 'configured' : 'missing api key',
      })
    } catch (err) {
      return reply.status(503).send({ status: 'error', error: String(err) })
    }
  })
}
