import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { docker } from '../lib/docker.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      await docker.ping()
      return reply.send({ status: 'ok', database: 'connected', docker: 'connected' })
    } catch (err) {
      return reply.status(503).send({ status: 'error', error: String(err) })
    }
  })
}
