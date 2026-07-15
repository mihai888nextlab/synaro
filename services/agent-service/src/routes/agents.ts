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

const ToolModeSchema = z.enum(['auto', 'manual'])

const BaseAgentSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().optional(),
  name: z.string().min(1).max(100),
  // nullish so the edit form can clear a field by sending null
  description: z.string().max(500).nullish(),
  systemPrompt: z.string().min(1),
  toolMode: ToolModeSchema.default('auto'),
  tools: z.array(z.enum(VALID_TOOLS)).default([]),
  maxSteps: z.number().int().min(1).max(50).default(20),
  schedule: z.string().nullish(),
  enabled: z.boolean().default(true),
  model: z.enum(VALID_MODELS).nullish(),
  // an empty array clears configured servers; the UI never sends null here
  mcpServers: z.array(McpServerSchema).optional(),
})

function refineManualTools(
  data: { toolMode?: 'auto' | 'manual'; tools?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (data.toolMode === 'manual' && (data.tools?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Manual mode requires at least one tool',
      path: ['tools'],
    })
  }
}

const CreateAgentSchema = BaseAgentSchema.superRefine(refineManualTools)

const UpdateAgentSchema = BaseAgentSchema.partial()
  .omit({ userId: true })
  .superRefine(refineManualTools)

/** Strip auth headers from MCP config — credentials are run-time only. */
function sanitizeMcpServers(
  servers: z.infer<typeof McpServerSchema>[] | undefined,
): z.infer<typeof McpServerSchema>[] | undefined {
  if (!servers) return servers
  return servers.map(({ headers, ...rest }) => {
    if (!headers) return rest
    const { Authorization: _auth, authorization: _authLower, ...safe } = headers
    return Object.keys(safe).length > 0 ? { ...rest, headers: safe } : rest
  })
}

function sanitizeAgentBody<T extends { mcpServers?: z.infer<typeof McpServerSchema>[] }>(
  data: T,
): T {
  if (!data.mcpServers) return data
  return { ...data, mcpServers: sanitizeMcpServers(data.mcpServers) }
}

const TriggerSchema = z.object({
  input: z.string().optional(),
  trigger: z.enum(['manual', 'cron', 'webhook']).default('manual'),
})

const WebhookSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['DONE', 'FAILED', 'CANCELLED']),
  output: z.string().optional(),
  steps: z.array(z.unknown()).optional(),
})

const CANCEL_OUTPUT = 'Cancelled by user'
const ACTIVE_RUN_STATUSES = ['PENDING', 'RUNNING', 'NEEDS_INPUT'] as const
const MAX_MEMORY_KEY_LENGTH = 100
const MAX_MEMORY_CONTENT_BYTES = 16 * 1024

const MemoryUpsertSchema = z.object({
  userId: z.string().min(1),
  content: z.string(),
})

const MemoryUserIdSchema = z.object({
  userId: z.string().min(1),
})

function decodeMemoryKey(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function validateMemoryKey(key: string): string | null {
  const trimmed = key.trim()
  if (!trimmed) return 'key is required'
  if (trimmed.length > MAX_MEMORY_KEY_LENGTH) return `key exceeds ${MAX_MEMORY_KEY_LENGTH} characters`
  return null
}

function validateMemoryContent(content: string): string | null {
  if (Buffer.byteLength(content, 'utf8') > MAX_MEMORY_CONTENT_BYTES) {
    return `content exceeds ${MAX_MEMORY_CONTENT_BYTES} byte limit`
  }
  return null
}

async function requireAgentOwner(
  agentId: string,
  userId: string,
  reply: FastifyReply,
): Promise<{ userId: string } | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { userId: true } })
  if (!agent) {
    reply.status(404).send({ error: 'Agent not found' })
    return null
  }
  if (agent.userId !== userId) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }
  return agent
}

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

    const agent = await prisma.agent.create({ data: sanitizeAgentBody(parsed.data) })
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
      const agent = await prisma.agent.update({ where: { id }, data: sanitizeAgentBody(parsed.data) })
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
      where: { userId, status: { in: ['PENDING', 'RUNNING', 'NEEDS_INPUT'] } },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(runs)
  })

  // Cancel an active run (user must own the run)
  app.post('/runs/:runId/cancel', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { runId } = req.params as { runId: string }
    const { userId } = req.body as { userId?: string }

    if (!userId) return reply.status(400).send({ error: 'userId required' })

    const run = await prisma.agentRun.findUnique({ where: { id: runId } })
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    if (run.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (!ACTIVE_RUN_STATUSES.includes(run.status as (typeof ACTIVE_RUN_STATUSES)[number])) {
      return reply.status(409).send({ error: `Run is ${run.status}, cannot cancel` })
    }

    const updated = await prisma.agentRun.updateMany({
      where: { id: runId, status: { in: [...ACTIVE_RUN_STATUSES] } },
      data: { status: 'CANCELLED', output: CANCEL_OUTPUT, finishedAt: new Date() },
    })
    if (updated.count !== 1) {
      return reply.status(409).send({ error: 'Run is no longer active' })
    }

    return reply.send({ ok: true, runId })
  })

  // Submit runtime MCP credentials and resume a paused run
  app.post('/runs/:runId/credentials', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { runId } = req.params as { runId: string }
    const { userId, mcpAuth } = req.body as { userId?: string; mcpAuth?: Record<string, Record<string, string>> }

    if (!userId) return reply.status(400).send({ error: 'userId required' })
    if (!mcpAuth || typeof mcpAuth !== 'object') {
      return reply.status(400).send({ error: 'mcpAuth object required' })
    }

    const run = await prisma.agentRun.findUnique({ where: { id: runId } })
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    if (run.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (run.status !== 'NEEDS_INPUT') {
      return reply.status(409).send({ error: `Run is ${run.status}, expected NEEDS_INPUT` })
    }

    const resumeRes = await fetch(`${agentRunnerUrl()}/api/run/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '',
      },
      body: JSON.stringify({ runId, mcpAuth }),
    })

    if (!resumeRes.ok) {
      const err = (await resumeRes.json().catch(() => ({}))) as { error?: unknown }
      return reply.status(resumeRes.status).send({ error: err.error ?? 'Failed to resume run' })
    }

    return reply.status(202).send({ ok: true, runId })
  })

  // Get single run
  app.get('/runs/:runId', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { runId } = req.params as { runId: string }

    const run = await prisma.agentRun.findUnique({ where: { id: runId } })
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    return reply.send(run)
  })

  // List durable memory entries for an agent
  app.get('/agents/:id/memory', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }
    const { userId } = req.query as { userId?: string }
    if (!userId) return reply.status(400).send({ error: 'userId query param required' })

    const agent = await requireAgentOwner(id, userId, reply)
    if (!agent) return

    const entries = await prisma.agentMemory.findMany({
      where: { agentId: id },
      orderBy: { updatedAt: 'desc' },
      select: { key: true, content: true, createdAt: true, updatedAt: true },
    })
    return reply.send(entries)
  })

  // Clear all memory entries for an agent
  app.delete('/agents/:id/memory', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id } = req.params as { id: string }
    const parsed = MemoryUserIdSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const agent = await requireAgentOwner(id, parsed.data.userId, reply)
    if (!agent) return

    await prisma.agentMemory.deleteMany({ where: { agentId: id } })
    return reply.status(204).send()
  })

  // Upsert a memory entry
  app.put('/agents/:id/memory/:key', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id, key: rawKey } = req.params as { id: string; key: string }
    const key = decodeMemoryKey(rawKey)
    const parsed = MemoryUpsertSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const keyError = validateMemoryKey(key)
    if (keyError) return reply.status(400).send({ error: keyError })
    const contentError = validateMemoryContent(parsed.data.content)
    if (contentError) return reply.status(400).send({ error: contentError })

    const agent = await requireAgentOwner(id, parsed.data.userId, reply)
    if (!agent) return

    const entry = await prisma.agentMemory.upsert({
      where: { agentId_key: { agentId: id, key: key.trim() } },
      create: { agentId: id, key: key.trim(), content: parsed.data.content },
      update: { content: parsed.data.content },
      select: { key: true, content: true, createdAt: true, updatedAt: true },
    })
    return reply.send(entry)
  })

  // Delete one memory entry
  app.delete('/agents/:id/memory/:key', async (req, reply) => {
    if (!requireServiceKey(req, reply)) return
    const { id, key: rawKey } = req.params as { id: string; key: string }
    const key = decodeMemoryKey(rawKey)
    const parsed = MemoryUserIdSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const agent = await requireAgentOwner(id, parsed.data.userId, reply)
    if (!agent) return

    try {
      await prisma.agentMemory.delete({
        where: { agentId_key: { agentId: id, key: key.trim() } },
      })
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Memory entry not found' })
    }
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
