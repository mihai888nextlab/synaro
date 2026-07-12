import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { executionRoutes } from './routes/executions.js'
import { healthRoutes } from './routes/health.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'

const app = Fastify({ logger })

await app.register(helmet)
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
})

await app.register(healthRoutes, { prefix: '/health' })
await app.register(executionRoutes, { prefix: '/api/executions' })

const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

try {
  const port = Number(process.env.PORT ?? 3004)
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  await prisma.$disconnect()
  process.exit(1)
}
