import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { healthRoutes } from './routes/health.js'
import { runRoutes } from './routes/run.js'
import { cronRoutes } from './routes/cron.js'
import { prisma } from './lib/prisma.js'
import {
  reloadCronJobsAtStartup,
  startPeriodicCronReload,
  startReaper,
  startPendingDispatcher,
} from './lib/scheduler.js'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
})

await app.register(helmet)
await app.register(cors)

await app.register(healthRoutes, { prefix: '/health' })
await app.register(runRoutes, { prefix: '/api/run' })
await app.register(cronRoutes, { prefix: '/api/cron' })

const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

try {
  const port = Number(process.env.PORT ?? 3006)
  await app.listen({ port, host: '0.0.0.0' })
  await reloadCronJobsAtStartup(app.log)
  startPeriodicCronReload(app.log)
  startReaper(app.log)
  startPendingDispatcher(app.log)
} catch (err) {
  app.log.error(err)
  await prisma.$disconnect()
  process.exit(1)
}
