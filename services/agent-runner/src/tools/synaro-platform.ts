import { prisma } from '../lib/prisma.js'
import type { AgentTool, ToolContext } from './types.js'

/**
 * Tools that let an agent read and act on the OWNER's own Synaro projects.
 *
 * The internal services (project-service / environment-service) have no auth and
 * scope by projectId only, so every tool here first resolves ownership against
 * the shared `synaro` DB (the same source of truth the app uses). Project rows
 * are read via raw SQL because the app owns those tables — we don't want them in
 * agent-runner's Prisma migration history.
 *
 * Ownership mirrors app/src/lib/project-access.ts:whereProjectByIdForUser —
 * a project is visible if the user owns it OR is a member.
 */

const ENV_TIMEOUT_MS = 120_000

function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || 'http://environment-service:3002'
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  slug: string
  status: string
}

async function getOwnedProject(projectId: string, userId: string): Promise<ProjectRow | null> {
  const rows = await prisma.$queryRaw<ProjectRow[]>`
    SELECT p.id, p.name, p.description, p.slug, p."environmentStatus" AS status
    FROM "Project" p
    WHERE p.id = ${projectId}
      AND (
        p."userId" = ${userId}
        OR EXISTS (
          SELECT 1 FROM "ProjectMember" m
          WHERE m."projectId" = p.id AND m."userId" = ${userId}
        )
      )
    LIMIT 1
  `
  return rows[0] ?? null
}

interface RemoteEnvironment {
  id: string
  projectId: string
  status: string
  subdomain?: string | null
  publicUrl?: string | null
}

async function fetchEnvironmentsForProject(projectId: string): Promise<RemoteEnvironment[]> {
  const url = `${environmentServiceBaseUrl()}/api/environments?projectId=${encodeURIComponent(projectId)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(ENV_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`environment-service ${res.status}`)
  const json = (await res.json()) as unknown
  return Array.isArray(json) ? (json as RemoteEnvironment[]) : []
}

/** Newest RUNNING/PROVISIONING row (env service returns createdAt desc). */
function pickActiveEnvironment(rows: RemoteEnvironment[]): RemoteEnvironment | null {
  return rows.find((r) => r.status === 'RUNNING' || r.status === 'PROVISIONING') ?? null
}

async function envServicePost(path: string): Promise<RemoteEnvironment> {
  const res = await fetch(`${environmentServiceBaseUrl()}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(ENV_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`environment-service ${res.status}`)
  return (await res.json()) as RemoteEnvironment
}

export const synaroPlatformTools: AgentTool[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_projects',
        description:
          "List the Synaro projects that belong to the current user. Use this to discover project ids before acting on a specific project.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(_args, ctx: ToolContext) {
      const rows = await prisma.$queryRaw<ProjectRow[]>`
        SELECT p.id, p.name, p.description, p.slug, p."environmentStatus" AS status
        FROM "Project" p
        WHERE p."userId" = ${ctx.userId}
          OR EXISTS (
            SELECT 1 FROM "ProjectMember" m
            WHERE m."projectId" = p.id AND m."userId" = ${ctx.userId}
          )
        ORDER BY p."lastActivityAt" DESC NULLS LAST, p."createdAt" DESC
        LIMIT 50
      `
      if (rows.length === 0) return 'You have no projects.'
      return rows
        .map((p) => `- ${p.name} (id: ${p.id}, slug: ${p.slug}, status: ${p.status})`)
        .join('\n')
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'get_project',
        description: "Get details of one of the current user's projects by its id.",
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'The project id' } },
          required: ['projectId'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const projectId = String(args.projectId ?? '')
      const project = await getOwnedProject(projectId, ctx.userId)
      if (!project) return `Error: project ${projectId} not found or not owned by you.`
      return JSON.stringify({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        status: project.status,
      })
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_project_runs',
        description:
          "List the runtime environments (running instances) of one of the current user's projects, with their status and public URL.",
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'The project id' } },
          required: ['projectId'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const projectId = String(args.projectId ?? '')
      if (!(await getOwnedProject(projectId, ctx.userId)))
        return `Error: project ${projectId} not found or not owned by you.`
      try {
        const envs = await fetchEnvironmentsForProject(projectId)
        if (envs.length === 0) return 'No runtime environments for this project.'
        return envs
          .map((e) => `- env ${e.id}: status=${e.status}, url=${e.publicUrl ?? '(none)'}`)
          .join('\n')
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'start_project',
        description:
          "Start (boot) the runtime environment of one of the current user's projects so it becomes reachable.",
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'The project id' } },
          required: ['projectId'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const projectId = String(args.projectId ?? '')
      if (!(await getOwnedProject(projectId, ctx.userId)))
        return `Error: project ${projectId} not found or not owned by you.`
      try {
        const env = pickActiveEnvironment(await fetchEnvironmentsForProject(projectId))
        if (!env) return 'Error: this project has no environment to start.'
        const started = await envServicePost(`/api/environments/${encodeURIComponent(env.id)}/start`)
        return `Started environment ${started.id} (status: ${started.status}).`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'stop_project',
        description:
          "Stop the runtime environment of one of the current user's projects.",
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'The project id' } },
          required: ['projectId'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const projectId = String(args.projectId ?? '')
      if (!(await getOwnedProject(projectId, ctx.userId)))
        return `Error: project ${projectId} not found or not owned by you.`
      try {
        const env = pickActiveEnvironment(await fetchEnvironmentsForProject(projectId))
        if (!env) return 'Error: this project has no running environment to stop.'
        const stopped = await envServicePost(`/api/environments/${encodeURIComponent(env.id)}/stop`)
        return `Stopped environment ${stopped.id} (status: ${stopped.status}).`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
]
