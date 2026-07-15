import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

// Keep in sync with agent-runner's tool catalog (services/agent-runner/src/tools/index.ts
// → VALID_TOOL_NAMES). The two services can't share code, so this list is duplicated.
const VALID_TOOLS = [
  // built-in
  'web_search',
  'http_get',
  'http_post',
  'finish',
  // Synaro platform
  'list_projects',
  'get_project',
  'list_project_runs',
  'start_project',
  'stop_project',
  // file workspace
  'list_files',
  'read_file',
  'write_file',
  'delete_file',
  // composition
  'run_agent',
  'mcp',
  // memory
  'remember',
  'recall',
] as const

const VALID_MODELS = ['kimi-k2.6', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] as const

const McpServerSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  transport: z.enum(['http', 'sse']).optional(),
  headers: z.record(z.string()).optional(),
})

function requireServiceKey(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = process.env.AGENT_SERVICE_KEY?.trim()
  if (key && req.headers['x-service-key'] !== key) {
    reply.status(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

function agentRunnerUrl(): string {
  return process.env.AGENT_RUNNER_URL?.trim() || 'http://agent-runner:3006'
}

/** Fire-and-forget: ask the runner to re-read cron schedules after an agent changes. */
function notifyCronReload(onError: (err: unknown) => void): void {
  void fetch(`${agentRunnerUrl()}/api/cron/reload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '' },
  }).catch(onError)
}

const CreateAgentSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().optional(),
  name: z.string().min(1).max(100),
  // nullish so the edit form can clear a field by sending null
  description: z.string().max(500).nullish(),
  systemPrompt: z.string().min(1),
  tools: z.array(z.enum(VALID_TOOLS)).default([]),
  maxSteps: z.number().int().min(1).max(50).default(20),
  schedule: z.string().nullish(),
  enabled: z.boolean().default(true),
  model: z.enum(VALID_MODELS).nullish(),
  // an empty array clears configured servers; the UI never sends null here
  mcpServers: z.array(McpServerSchema).optional(),
})

const UpdateAgentSchema = CreateAgentSchema.partial().omit({ userId: true })

const TriggerSchema = z.object({
  input: z.string().optional(),
  trigger: z.enum(['manual', 'cron', 'webhook']).default('manual'),
})

const WebhookSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['DONE', 'FAILED']),
  output: z.string().optional(),
  steps: z.array(z.unknown()).optional(),
})

export const agentRoutes: FastifyPluginAsync = async (app) => {
  // List agents for a user
  app.get('/agents', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { userId } = req.query as { userId?: string }
    if (!userId) return reply.status(400).send({ error: 'userId query param required' })

    const agents = await prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(agents)
  })

  // Create agent
  app.post('/agents', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const parsed = CreateAgentSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const agent = await prisma.agent.create({ data: parsed.data })
    notifyCronReload((err) => app.log.error({ err }, 'cron reload failed'))
    return reply.status(201).send(agent)
  })

  // Get single agent
  app.get('/agents/:id', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    return reply.send(agent)
  })

  // Update agent
  app.patch('/agents/:id', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }
    const parsed = UpdateAgentSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    try {
      const agent = await prisma.agent.update({ where: { id }, data: parsed.data })
      notifyCronReload((err) => app.log.error({ err }, 'cron reload failed'))
      return reply.send(agent)
    } catch {
      return reply.status(404).send({ error: 'Agent not found' })
    }
  })

  // Delete agent
  app.delete('/agents/:id', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }

    try {
      await prisma.agent.delete({ where: { id } })
      notifyCronReload((err) => app.log.error({ err }, 'cron reload failed'))
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Agent not found' })
    }
  })

  // Trigger a run
  app.post('/agents/:id/trigger', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }
    const parsed = TriggerSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })
    if (!agent.enabled) return reply.status(409).send({ error: 'Agent is disabled' })

    const run = await prisma.agentRun.create({
      data: {
        agentId: agent.id,
        userId: agent.userId,
        status: 'PENDING',
        trigger: parsed.data.trigger,
        input: parsed.data.input ?? null,
      },
    })

    // Fire-and-forget: tell the runner to start the run
    void fetch(`${agentRunnerUrl()}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '' },
      body: JSON.stringify({ runId: run.id }),
    }).catch((err) => {
      app.log.error({ err }, 'Failed to notify agent-runner')
    })

    return reply.status(202).send({ runId: run.id })
  })

  // List runs for an agent
  app.get('/agents/:id/runs', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }
    const { limit = '20', offset = '0' } = req.query as { limit?: string; offset?: string }

    const runs = await prisma.agentRun.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 20, 100),
      skip: Number(offset) || 0,
    })
    return reply.send(runs)
  })

  // Active runs for a user (PENDING / RUNNING)
  app.get('/runs/active', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { userId } = req.query as { userId?: string }
    if (!userId) return reply.status(400).send({ error: 'userId query param required' })

    const runs = await prisma.agentRun.findMany({
      where: { userId, status: { in: ['PENDING', 'RUNNING'] } },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(runs)
  })

  // Get single run
  app.get('/runs/:runId', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { runId } = req.params as { runId: string }

    const run = await prisma.agentRun.findUnique({ where: { id: runId } })
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    return reply.send(run)
  })

  // Webhook from agent-runner on run completion
  app.post('/webhook/run-complete', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const parsed = WebhookSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const { runId, status, output, steps } = parsed.data

    try {
      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          status,
          output: output ?? null,
          steps: steps ? (steps as object[]) : undefined,
          finishedAt: new Date(),
        },
      })
      return reply.send({ ok: true })
    } catch {
      return reply.status(404).send({ error: 'Run not found' })
    }
  })
}
