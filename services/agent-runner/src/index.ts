import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cron from 'node-cron'
import { healthRoutes } from './routes/health.js'
import { runRoutes } from './routes/run.js'
import { prisma } from './lib/prisma.js'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
})

await app.register(helmet)
await app.register(cors)

await app.register(healthRoutes, { prefix: '/health' })
await app.register(runRoutes, { prefix: '/api/run' })

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || 'http://agent-service:3005'
}

async function triggerCronAgent(agentId: string): Promise<void> {
  try {
    await fetch(`${agentServiceUrl()}/api/agents/${agentId}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '',
      },
      body: JSON.stringify({ trigger: 'cron' }),
    })
  } catch (err) {
    app.log.error({ err, agentId }, 'Failed to trigger cron agent')
  }
}

// Register cron jobs for all scheduled agents on startup
async function registerCronJobs(): Promise<void> {
  const agents = await prisma.agent.findMany({
    where: { enabled: true, schedule: { not: null } },
    select: { id: true, name: true, schedule: true },
  })

  for (const agent of agents) {
    if (!agent.schedule || !cron.validate(agent.schedule)) {
      app.log.warn({ agentId: agent.id }, 'Invalid or missing cron schedule — skipping')
      continue
    }

    cron.schedule(agent.schedule, () => {
      void triggerCronAgent(agent.id)
    })

    app.log.info({ agentId: agent.id, name: agent.name, schedule: agent.schedule }, 'Cron job registered')
  }

  app.log.info(`Registered ${agents.length} cron agent(s)`)
}

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
  await registerCronJobs()
} catch (err) {
  app.log.error(err)
  await prisma.$disconnect()
  process.exit(1)
}
