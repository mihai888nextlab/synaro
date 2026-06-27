import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { runReActLoop } from '../runner/react-loop.js'

function requireServiceKey(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = process.env.AGENT_SERVICE_KEY?.trim()
  if (key && req.headers['x-service-key'] !== key) {
    reply.status(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

const RunSchema = z.object({
  runId: z.string().min(1),
})

export const runRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return

    const parsed = RunSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const { runId } = parsed.data

    const run = await prisma.agentRun.findUnique({ where: { id: runId } })
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    if (run.status !== 'PENDING') return reply.status(409).send({ error: `Run is already ${run.status}` })

    const agent = await prisma.agent.findUnique({ where: { id: run.agentId } })
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })

    // Start the loop in the background — don't await
    void runReActLoop(run, agent).catch((err) => {
      app.log.error({ err, runId }, 'Unhandled error in ReAct loop')
    })

    return reply.status(202).send({ ok: true, runId })
  })
}
