import { prisma } from '../lib/prisma.js'
import type { AgentTool, ToolContext } from './types.js'

/**
 * Lets an agent delegate a sub-task to ANOTHER of the same user's agents. The
 * sub-agent is triggered through agent-service (so it gets a proper, tracked
 * AgentRun) and this tool polls until that run finishes, then returns its output.
 *
 * Guards: the target must belong to the same user, self-delegation is rejected,
 * and per-run fan-out is naturally bounded by the caller's maxSteps.
 */

const POLL_INTERVAL_MS = 2_000
const MAX_WAIT_MS = 180_000

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || 'http://agent-service:3005'
}

function serviceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '',
  }
}

async function triggerRun(agentId: string, input: string): Promise<string | null> {
  const res = await fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(agentId)}/trigger`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ input, trigger: 'webhook' }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { runId?: string }
  return body.runId ?? null
}

interface RunRow {
  status: string
  output: string | null
}

async function pollRun(runId: string): Promise<RunRow | null> {
  const res = await fetch(`${agentServiceUrl()}/api/runs/${encodeURIComponent(runId)}`, {
    headers: serviceHeaders(),
  })
  if (!res.ok) return null
  return (await res.json()) as RunRow
}

export const subAgentTools: AgentTool[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'run_agent',
        description:
          'Delegate a sub-task to another one of your agents by its id. Waits for it to finish and returns its output. Use for specialised helpers.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'The id of the agent to delegate to' },
            input: { type: 'string', description: 'The task/input to give the sub-agent' },
          },
          required: ['agentId', 'input'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const targetId = String(args.agentId ?? '')
      const input = String(args.input ?? '')

      if (!targetId) return 'Error: agentId is required.'
      if (targetId === ctx.agentId) return 'Error: an agent cannot delegate to itself.'
      if (ctx.depth >= 2) return 'Error: sub-agent delegation depth limit reached.'

      const target = await prisma.agent.findUnique({
        where: { id: targetId },
        select: { id: true, userId: true, enabled: true },
      })
      if (!target || target.userId !== ctx.userId)
        return `Error: agent ${targetId} not found or not owned by you.`
      if (!target.enabled) return `Error: agent ${targetId} is disabled.`

      const runId = await triggerRun(targetId, input)
      if (!runId) return 'Error: failed to start the sub-agent.'

      const deadline = Date.now() + MAX_WAIT_MS
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        const run = await pollRun(runId)
        if (!run) continue
        if (run.status === 'DONE') return run.output ?? '(no output)'
        if (run.status === 'FAILED') return `Sub-agent failed: ${run.output ?? 'unknown error'}`
      }
      return 'Error: sub-agent timed out.'
    },
  },
]
