import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { taskRoutes } from './routes/tasks.js'
import { healthRoutes } from './routes/health.js'
import { prisma } from './lib/prisma.js'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
})

await app.register(helmet)
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
})

await app.register(healthRoutes, { prefix: '/health' })
await app.register(taskRoutes, { prefix: '/api/tasks' })

const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

try {
  const port = Number(process.env.PORT ?? 3003)
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  await prisma.$disconnect()
  process.exit(1)
}
