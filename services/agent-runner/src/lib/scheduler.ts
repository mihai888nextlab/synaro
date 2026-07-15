import cron, { type ScheduledTask } from 'node-cron'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from './prisma.js'

const SCHEDULE_CRON_SEPARATOR = '|'

function splitScheduleCrons(schedule: string): string[] {
  return schedule
    .split(SCHEDULE_CRON_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)
}
import { runReActLoop } from '../runner/react-loop.js'

/**
 * Scheduling & self-healing for agent runs:
 *  - reloadCronJobs: (re)register cron-scheduled agents, callable at runtime so
 *    schedule changes take effect without restarting the runner.
 *  - startReaper: fail runs stuck in RUNNING past a timeout.
 *  - startPendingDispatcher: pick up PENDING runs that were never dispatched
 *    (e.g. the runner was down when the trigger fired).
 */

const REAPER_INTERVAL_MS = 60_000
const RUN_TIMEOUT_MS = 15 * 60_000
const DISPATCH_INTERVAL_MS = 30_000
const PENDING_GRACE_MS = 30_000

const tasks = new Map<string, ScheduledTask[]>()

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || 'http://agent-service:3005'
}

async function triggerCronAgent(agentId: string, log: FastifyBaseLogger): Promise<void> {
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
    log.error({ err, agentId }, 'Failed to trigger cron agent')
  }
}

/** Tear down existing schedules and re-register from the current DB state. */
export async function reloadCronJobs(log: FastifyBaseLogger): Promise<number> {
  for (const taskList of tasks.values()) {
    for (const task of taskList) task.stop()
  }
  tasks.clear()

  const agents = await prisma.agent.findMany({
    where: { enabled: true, schedule: { not: null } },
    select: { id: true, name: true, schedule: true },
  })

  let registered = 0
  for (const agent of agents) {
    if (!agent.schedule) continue
    const expressions = splitScheduleCrons(agent.schedule)
    if (expressions.length === 0) {
      log.warn({ agentId: agent.id }, 'Invalid or missing cron schedule — skipping')
      continue
    }

    const agentTasks: ScheduledTask[] = []
    for (const expression of expressions) {
      if (!cron.validate(expression)) {
        log.warn({ agentId: agent.id, schedule: expression }, 'Invalid cron expression — skipping')
        continue
      }
      const task = cron.schedule(expression, () => {
        void triggerCronAgent(agent.id, log)
      })
      agentTasks.push(task)
      registered += 1
    }

    if (agentTasks.length > 0) {
      tasks.set(agent.id, agentTasks)
      log.info(
        { agentId: agent.id, name: agent.name, schedules: expressions.length },
        'Cron job(s) registered',
      )
    }
  }

  log.info(`Registered ${registered} cron expression(s) for ${tasks.size} agent(s)`)
  return registered
}

export function startReaper(log: FastifyBaseLogger): void {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const cutoff = new Date(Date.now() - RUN_TIMEOUT_MS)
        const reaped = await prisma.agentRun.updateMany({
          where: { status: 'RUNNING', startedAt: { lt: cutoff } },
          data: { status: 'FAILED', output: 'Run timed out', finishedAt: new Date() },
        })
        if (reaped.count > 0) log.warn({ count: reaped.count }, 'Reaped stale runs')
      } catch (err) {
        log.error({ err }, 'Reaper tick failed')
      }
    })()
  }, REAPER_INTERVAL_MS)
  timer.unref()
}

export function startPendingDispatcher(log: FastifyBaseLogger): void {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const cutoff = new Date(Date.now() - PENDING_GRACE_MS)
        const pending = await prisma.agentRun.findMany({
          where: { status: 'PENDING', createdAt: { lt: cutoff } },
          take: 10,
        })
        for (const run of pending) {
          // Atomically claim the run so we never double-dispatch.
          const claimed = await prisma.agentRun.updateMany({
            where: { id: run.id, status: 'PENDING' },
            data: { status: 'RUNNING', startedAt: new Date() },
          })
          if (claimed.count !== 1) continue

          const agent = await prisma.agent.findUnique({ where: { id: run.agentId } })
          if (!agent) {
            await prisma.agentRun.update({
              where: { id: run.id },
              data: { status: 'FAILED', output: 'Agent no longer exists', finishedAt: new Date() },
            })
            continue
          }
          log.info({ runId: run.id }, 'Re-dispatching orphaned PENDING run')
          void runReActLoop(run, agent, log).catch((err) => {
            log.error({ err, runId: run.id }, 'Re-dispatch failed')
          })
        }
      } catch (err) {
        log.error({ err }, 'Pending dispatcher tick failed')
      }
    })()
  }, DISPATCH_INTERVAL_MS)
  timer.unref()
}
