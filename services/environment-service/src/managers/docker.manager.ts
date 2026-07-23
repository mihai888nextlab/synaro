import { Buffer } from 'node:buffer'
import { createGzip } from 'node:zlib'
import { PassThrough, Readable } from 'node:stream'

import { docker } from '../lib/docker.js'
import {
  buildWorkspaceFindPruneExpr,
  filterWorkspaceTreePaths,
} from '../lib/workspace-tree-filter.js'
import { prisma } from '../lib/prisma.js'
import { toGithubAuthenticatedCloneUrl, toPublicGitCloneUrl } from '../lib/git-clone.js'

type EnvironmentStatus = 'INACTIVE' | 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'ERROR'
const BASE_PORT = 4000
const MAX_PORT = 4999

/**
 * When set, user containers are exposed via Traefik reverse proxy at
 * `{subdomain}.{SYNARO_DOMAIN}` instead of `localhost:{port}`.
 * Leave unset for local development (port-binding mode).
 */
const SYNARO_DOMAIN = process.env.SYNARO_DOMAIN?.trim() ?? ''
const TRAEFIK_NETWORK = process.env.TRAEFIK_NETWORK?.trim() || 'traefik-net'
// Empty by default: only pin an ACME certresolver on env routers when one is actually configured
// in Traefik. Referencing a resolver Traefik doesn't have makes it drop the whole router (404).
const ACME_RESOLVER = process.env.ACME_RESOLVER?.trim() || ''

/** Build a URL-safe subdomain from a project slug + first 6 chars of env UUID. */
function buildSubdomain(projectSlug: string, envId: string): string {
  const slug = projectSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  const suffix = envId.replace(/-/g, '').slice(0, 6)
  return `${slug}-${suffix}`
}

/**
 * Named Docker volume that persists a project's workspace across env-container recreation.
 * Keyed by **projectId** (not env id) so a fresh env for the same project reuses the same files —
 * without this, destroying/recreating a container wipes all non-git work.
 */
export function workspaceVolumeName(projectId: string): string {
  // Docker volume names must be [a-zA-Z0-9][a-zA-Z0-9_.-]*; project ids are UUIDs, sanitize defensively.
  return `synaro-ws-${projectId.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
}

/** Compute public URL for an environment. Falls back to localhost:{port} for local dev. */
export function envPublicUrl(env: { subdomain?: string | null; port?: number | null }): string | null {
  if (SYNARO_DOMAIN && env.subdomain) return `https://${env.subdomain}.${SYNARO_DOMAIN}`
  if (env.port) return `http://localhost:${env.port}`
  return null
}
/** Workspace root inside the environment container (matches `git clone … app`). */
export const WORKSPACE_ROOT = '/tmp/synaro-workspace/app'

/**
 * Directory where the interactive terminal should start (`HOME` + cwd).
 * Uses `…/app`, or a single nested folder inside it (common folder-upload layout).
 */
export async function resolveTerminalWorkspaceDir(containerId: string): Promise<string> {
  const script = [
    `ROOT="${WORKSPACE_ROOT}"`,
    'if [ ! -d "$ROOT" ]; then',
    '  if [ -d /tmp/synaro-workspace ]; then ROOT=/tmp/synaro-workspace; else ROOT=/; fi',
    'fi',
    'cd "$ROOT" || exit 1',
    'count=$(ls -A 2>/dev/null | wc -l | tr -d " ")',
    'if [ "$count" = "1" ]; then',
    '  only=$(ls -A 2>/dev/null | head -n 1)',
    '  if [ -n "$only" ] && [ -d "$only" ]; then cd "$only" 2>/dev/null || true; fi',
    'fi',
    'pwd',
  ].join('\n')
  try {
    const out = await execShellInContainer(containerId, script)
    const line = out
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .pop()
    if (line?.startsWith('/')) return line
  } catch {
    /* fall through */
  }
  return WORKSPACE_ROOT
}

// Find a free port in our range by checking existing environments
async function allocatePort(): Promise<number> {
  const used = await prisma.environment.findMany({
    where: { port: { not: null } },
    select: { port: true },
  })
  const usedPorts = new Set(used.map((e: { port: number | null }) => e.port))
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) return port
  }
  throw new Error('No available ports in range')
}

async function updateStatus(
  id: string,
  status: EnvironmentStatus,
  extra?: { containerId?: string; port?: number; subdomain?: string },
) {
  return prisma.environment.update({
    where: { id },
    data: { status, ...extra },
  })
}

async function execShellInContainer(containerId: string, script: string, env: string[] = []): Promise<string> {
  const container = docker.getContainer(containerId)
  const exec = await container.exec({
    Cmd: ['sh', '-c', script],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    ...(env.length > 0 ? { Env: env } : {}),
  })
  const stream = await exec.start({ Detach: false, Tty: true })
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return Buffer.concat(chunks).toString('utf8').trimEnd()
}

/** Wait until Docker reports the main process is running (PID 1 alive). */
async function waitUntilContainerRunning(containerId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const container = docker.getContainer(containerId)
  while (Date.now() < deadline) {
    try {
      const ins = await container.inspect()
      if (ins.State?.Running) return true
      if (ins.State?.Status === 'exited' || ins.State?.Status === 'dead') return false
    } catch {
      return false
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

/** After start, wait for clone marker files (see createEnvironment shell). */
async function waitForCloneOutcome(
  containerId: string,
  timeoutMs: number,
): Promise<'ok' | 'failed' | 'timeout' | 'exited'> {
  const deadline = Date.now() + timeoutMs
  const container = docker.getContainer(containerId)
  while (Date.now() < deadline) {
    try {
      const ins = await container.inspect()
      if (!ins.State?.Running) return 'exited'
    } catch {
      return 'exited'
    }
    let out = ''
    try {
      out = await execShellInContainer(
        containerId,
        'if test -f /tmp/synaro-workspace/.synaro-clone-ok; then echo SYNARO_OK; ' +
          'elif test -f /tmp/synaro-workspace/.synaro-clone-failed; then echo SYNARO_FAIL; ' +
          'else echo SYNARO_WAIT; fi',
      )
    } catch {
      out = 'SYNARO_WAIT'
    }
    const t = out.trim()
    if (t.includes('SYNARO_OK')) return 'ok'
    if (t.includes('SYNARO_FAIL')) return 'failed'
    await new Promise((r) => setTimeout(r, 450))
  }
  return 'timeout'
}

export type CreateEnvironmentOptions = {
  /** Canonical https://github.com/org/repo (no credentials). */
  gitRemoteUrl?: string | null
  /** GitHub OAuth token for private repo clone (x-access-token). */
  gitAccessToken?: string | null
  /** Project slug used to build the Traefik subdomain (e.g. "my-express-app"). */
  projectSlug?: string | null
}

export async function createEnvironment(
  projectId: string,
  image: string = 'node:20-alpine',
  options?: CreateEnvironmentOptions,
) {
  const gitRemoteUrl = options?.gitRemoteUrl?.trim() || null
  const gitAccessToken = options?.gitAccessToken?.trim() || null

  const environment = await prisma.environment.create({
    data: {
      projectId,
      image,
      status: 'PROVISIONING',
      gitRemoteUrl,
    },
  })

  try {
    // In Traefik mode (SYNARO_DOMAIN set) containers are reached via the proxy network —
    // no host port binding needed. In local-dev mode we still allocate a host port.
    const useTraefik = Boolean(SYNARO_DOMAIN)
    const port = useTraefik ? null : await allocatePort()
    // In Traefik mode every environment MUST get a subdomain — it's the only way to reach the
    // container (no host port is bound). Fall back to a generic label if no slug was provided,
    // otherwise the env has no route and `run` fails with "Environment has no port assigned".
    const subdomain = useTraefik
      ? buildSubdomain(options?.projectSlug || 'app', environment.id)
      : null

    // Pull image if not present
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err: unknown) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })

    let cloneUrlForEnv: string | undefined
    if (gitRemoteUrl) {
      try {
        cloneUrlForEnv = gitAccessToken
          ? toGithubAuthenticatedCloneUrl(gitRemoteUrl, gitAccessToken)
          : toPublicGitCloneUrl(gitRemoteUrl)
      } catch {
        cloneUrlForEnv = undefined
      }
    }

    const env: string[] = []
    let cmd: string
    if (cloneUrlForEnv) {
      env.push(`SYNARO_GIT_CLONE_URL=${cloneUrlForEnv}`)
      // Do not use `set -e` for clone: on failure the container must stay up so we can mark ERROR and surface logs.
      // Marker files let the manager wait until clone finishes before marking RUNNING in the DB.
      cmd =
        'apk add --no-cache git >/dev/null 2>&1 || true; ' +
        'mkdir -p /tmp/synaro-workspace; cd /tmp/synaro-workspace; ' +
        'rm -f .synaro-clone-ok .synaro-clone-failed; ' +
        // Persistent volume: if the workspace already has content from a prior run, reuse it —
        // a non-empty `app` would make `git clone app` fail. Only clone into an empty/missing dir.
        'if [ -d app ] && [ -n "$(ls -A app 2>/dev/null)" ]; then touch .synaro-clone-ok; ' +
        'elif git clone --depth 1 "$SYNARO_GIT_CLONE_URL" app; then touch .synaro-clone-ok; ' +
        'else touch .synaro-clone-failed; fi; ' +
        'exec tail -f /dev/null'
    } else {
      // Same layout as git clone (`…/app`) so folder uploads and `putArchive` have a target directory.
      cmd =
        'apk add --no-cache git >/dev/null 2>&1 || true; ' +
        'mkdir -p /tmp/synaro-workspace/app && echo "Environment ready" && exec tail -f /dev/null'
    }

    // Build Traefik labels when running behind the proxy (VPS / production mode).
    const labels: Record<string, string> = {
      'synaro.environment.id': environment.id,
      'synaro.project.id': projectId,
    }
    if (useTraefik && subdomain) {
      const routerName = `synaro-env-${environment.id}`
      const hostRule = `Host(\`${subdomain}.${SYNARO_DOMAIN}\`)`
      labels['traefik.enable'] = 'true'
      labels[`traefik.http.services.${routerName}.loadbalancer.server.port`] = '3000'
      // HTTPS router (direct TLS, or Cloudflare "Full" mode): serve on websecure with the file cert.
      labels[`traefik.http.routers.${routerName}.rule`] = hostRule
      labels[`traefik.http.routers.${routerName}.entrypoints`] = 'websecure'
      labels[`traefik.http.routers.${routerName}.tls`] = 'true'
      labels[`traefik.http.routers.${routerName}.service`] = routerName
      // Only reference a certresolver when Traefik actually has one — otherwise it drops the router.
      if (ACME_RESOLVER) {
        labels[`traefik.http.routers.${routerName}.tls.certresolver`] = ACME_RESOLVER
      }
      // HTTP router (plain :80): Cloudflare "Flexible" mode connects to the origin over HTTP.
      // Without this, subdomains 404 whenever Cloudflare terminates TLS and forwards on port 80.
      labels[`traefik.http.routers.${routerName}-http.rule`] = hostRule
      labels[`traefik.http.routers.${routerName}-http.entrypoints`] = 'web'
      labels[`traefik.http.routers.${routerName}-http.service`] = routerName
    }

    const hostConfig: Record<string, unknown> = {
      Memory: 512 * 1024 * 1024, // 512 MB
      NanoCpus: 500_000_000, // 0.5 CPU
      // In Traefik mode put the container on the shared proxy network so Traefik can reach it.
      // In local-dev mode use the default bridge with an explicit port binding.
      NetworkMode: useTraefik ? TRAEFIK_NETWORK : 'bridge',
      // Persist the workspace on a per-project named volume so destroying/recreating the container
      // (e.g. to change Traefik labels) no longer wipes non-git work. Docker auto-creates the volume
      // on first use; it survives env recreation and is removed only on full project deletion.
      Mounts: [
        {
          Type: 'volume',
          Source: workspaceVolumeName(projectId),
          Target: '/tmp/synaro-workspace',
        },
      ],
    }
    if (port !== null) {
      hostConfig.PortBindings = { '3000/tcp': [{ HostPort: String(port) }] }
    }

    const container = await docker.createContainer({
      Image: image,
      Cmd: ['sh', '-c', cmd],
      Env: env,
      Labels: labels,
      HostConfig: hostConfig,
    })

    await container.start()

    const containerId = container.id
    if (cloneUrlForEnv) {
      const outcome = await waitForCloneOutcome(containerId, 180_000)
      if (outcome === 'exited') {
        await updateStatus(environment.id, 'ERROR')
        throw new Error('Environment container exited during git clone (check repo URL, auth, or network).')
      }
      if (outcome === 'failed' || outcome === 'timeout') {
        await updateStatus(environment.id, 'ERROR')
        throw new Error(
          outcome === 'timeout'
            ? 'Git clone timed out (repository too large or network too slow).'
            : 'Git clone failed inside the container.',
        )
      }
    } else {
      const up = await waitUntilContainerRunning(containerId, 60_000)
      if (!up) {
        await updateStatus(environment.id, 'ERROR')
        throw new Error('Container did not stay running.')
      }
    }

    return updateStatus(environment.id, 'RUNNING', {
      containerId,
      ...(port !== null ? { port } : {}),
      ...(subdomain ? { subdomain } : {}),
    })
  } catch (err) {
    await updateStatus(environment.id, 'ERROR')
    throw err
  }
}

/**
 * Extract a tar archive into the project workspace directory inside the container.
 */
export async function uploadWorkspaceTar(environmentId: string, tar: Buffer): Promise<void> {
  if (!tar.length) throw new Error('Empty archive')

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const container = docker.getContainer(environment.containerId)
  let inspect: Awaited<ReturnType<typeof container.inspect>>
  try {
    inspect = await container.inspect()
  } catch {
    throw new Error('No container found for this environment')
  }
  if (!inspect.State?.Running) {
    throw new Error('Container is not running')
  }

  // Docker putArchive requires the destination path to exist (non-git envs only had mkdir here).
  await execShellInContainer(environment.containerId, `mkdir -p "${WORKSPACE_ROOT}"`)

  const stream = Readable.from(tar)
  await container.putArchive(stream, { path: WORKSPACE_ROOT })
}

const MAX_WORKSPACE_EXPORT_BYTES = 100 * 1024 * 1024

/**
 * Stream a gzip-compressed tar of the project workspace directory from the running container.
 */
export async function exportWorkspaceTarGzip(environmentId: string): Promise<Readable> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING') {
    throw new Error('Container must be running to download the workspace')
  }

  const container = docker.getContainer(environment.containerId)
  let inspect: Awaited<ReturnType<typeof container.inspect>>
  try {
    inspect = await container.inspect()
  } catch {
    throw new Error('No container found for this environment')
  }
  if (!inspect.State?.Running) {
    throw new Error('Container is not running')
  }

  const workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)
  const sizeRaw = await execShellInContainer(
    environment.containerId,
    `du -sb "${workspaceDir}" 2>/dev/null | awk '{print $1}'`,
  )
  const bytes = parseInt(sizeRaw.trim(), 10)
  if (Number.isFinite(bytes) && bytes > MAX_WORKSPACE_EXPORT_BYTES) {
    throw new Error(
      `Workspace is too large to download (${Math.ceil(bytes / (1024 * 1024))} MB). Limit is ${MAX_WORKSPACE_EXPORT_BYTES / (1024 * 1024)} MB.`,
    )
  }

  const tarStream = await container.getArchive({ path: workspaceDir })
  const gzip = createGzip()
  tarStream.on('error', (err: Error) => gzip.destroy(err))
  tarStream.pipe(gzip)
  return gzip
}

export async function stopEnvironment(id: string) {
  const environment = await prisma.environment.findUnique({ where: { id } })
  if (!environment?.containerId) throw new Error('No container found')

  const container = docker.getContainer(environment.containerId)
  await container.stop()

  return updateStatus(id, 'STOPPED')
}

export async function startEnvironment(id: string) {
  const environment = await prisma.environment.findUnique({ where: { id } })
  if (!environment?.containerId) throw new Error('No container found')

  await updateStatus(id, 'PROVISIONING')

  const container = docker.getContainer(environment.containerId)
  await container.start()

  const up = await waitUntilContainerRunning(environment.containerId, 60_000)
  if (!up) {
    await updateStatus(id, 'ERROR')
    throw new Error('Container did not stay running after start.')
  }

  return updateStatus(id, 'RUNNING')
}

export async function destroyEnvironment(id: string, opts?: { removeVolume?: boolean }) {
  const environment = await prisma.environment.findUnique({ where: { id } })

  if (environment?.containerId) {
    const container = docker.getContainer(environment.containerId)
    try {
      await container.stop()
    } catch {
      // container may already be stopped
    }
    try {
      await container.remove()
    } catch {
      // container may already be removed (e.g. manual `docker rm`) — still delete the DB row
    }
  }

  // The workspace volume intentionally SURVIVES a normal destroy so recreating a container (which is
  // destroy+create) preserves the user's work. Only remove it when the whole project is deleted.
  if (opts?.removeVolume && environment?.projectId) {
    try {
      await docker.getVolume(workspaceVolumeName(environment.projectId)).remove({ force: true })
    } catch {
      // volume may not exist or still be mounted by another env for the same project — best effort
    }
  }

  return prisma.environment.delete({ where: { id } })
}

/**
 * Mark DB rows as STOPPED when Docker says the container is not running (fixes stale RUNNING after crash/exit).
 */
export async function reconcileDeadContainersForProject(projectId: string): Promise<void> {
  const running = await prisma.environment.findMany({
    where: { projectId, status: 'RUNNING' },
    select: { id: true, containerId: true },
  })
  for (const e of running) {
    if (!e.containerId) continue
    try {
      const c = docker.getContainer(e.containerId)
      const ins = await c.inspect()
      if (!ins.State?.Running) {
        await prisma.environment.update({ where: { id: e.id }, data: { status: 'STOPPED' } })
      }
    } catch {
      await prisma.environment.update({ where: { id: e.id }, data: { status: 'STOPPED' } }).catch(() => {})
    }
  }
}

export async function getContainerStats(id: string) {
  const environment = await prisma.environment.findUnique({ where: { id } })
  if (!environment?.containerId) throw new Error('No container found')

  const container = docker.getContainer(environment.containerId)
  const stats = await container.stats({ stream: false })
  return stats
}

const WORKSPACE_LIST_MAX = 800

function rootLabelFromGitUrl(url: string | null): string {
  if (!url?.trim()) return 'repository'
  try {
    const u = url.replace(/\.git$/i, '')
    const seg = u.split('/').filter(Boolean).pop()
    return seg && seg.length > 0 ? seg : 'repository'
  } catch {
    return 'repository'
  }
}

/**
 * Lists text files under the cloned repo inside the environment container (see createEnvironment cmd).
 */
export async function listWorkspaceFilePaths(environmentId: string): Promise<{
  paths: string[]
  truncated: boolean
  rootLabel: string
  inactive?: boolean
  clonePending?: boolean
}> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const rootLabel = rootLabelFromGitUrl(environment.gitRemoteUrl)
  const container = docker.getContainer(environment.containerId)

  let inspect: Awaited<ReturnType<typeof container.inspect>>
  try {
    inspect = await container.inspect()
  } catch {
    throw new Error('No container found for this environment')
  }

  if (!inspect.State?.Running) {
    if (environment.status === 'RUNNING' || environment.status === 'PROVISIONING') {
      await prisma.environment.update({ where: { id: environmentId }, data: { status: 'STOPPED' } }).catch(() => {})
    }
    return { paths: [], truncated: false, rootLabel, inactive: true }
  }

  // Legacy / in-flight clones without waiting on create: treat missing OK marker as still cloning.
  if (environment.gitRemoteUrl?.trim()) {
    try {
      const st = await execShellInContainer(
        environment.containerId,
        `if test -f /tmp/synaro-workspace/.synaro-clone-ok || test -f "${WORKSPACE_ROOT}/.git/HEAD"; then echo SYNARO_READY; ` +
          `elif test -f /tmp/synaro-workspace/.synaro-clone-failed; then echo SYNARO_BAD; else echo SYNARO_WAIT; fi`,
      )
      const u = st.trim()
      if (u.includes('SYNARO_WAIT')) {
        return { paths: [], truncated: false, rootLabel, clonePending: true }
      }
      if (u.includes('SYNARO_BAD')) {
        return { paths: [], truncated: false, rootLabel, inactive: true }
      }
    } catch {
      return { paths: [], truncated: false, rootLabel, clonePending: true }
    }
  }

  // No `set -e`: avoid failing the whole exec when `cd` races with a slow clone.
  let workspaceDir = WORKSPACE_ROOT
  try {
    workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)
  } catch {
    workspaceDir = WORKSPACE_ROOT
  }

  const pruneExpr = buildWorkspaceFindPruneExpr()
  const script = [
    `if [ ! -d "${workspaceDir}" ]; then exit 0; fi`,
    `cd "${workspaceDir}" 2>/dev/null || exit 0`,
    `find . \\( ${pruneExpr} \\) -prune -o -type f ! -path '*/.*' ! -name '.*' -print 2>/dev/null | LC_ALL=C sort | head -n ${
      WORKSPACE_LIST_MAX + 1
    }`,
  ].join('; ')

  let raw = ''
  try {
    raw = await execShellInContainer(environment.containerId, script)
  } catch {
    return { paths: [], truncated: false, rootLabel, inactive: true }
  }

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const truncated = lines.length > WORKSPACE_LIST_MAX
  const rawPaths = (truncated ? lines.slice(0, WORKSPACE_LIST_MAX) : lines).map((l) =>
    l.replace(/^\.\//, ''),
  )
  const paths = filterWorkspaceTreePaths(rawPaths)

  return { paths, truncated, rootLabel }
}

const WORKSPACE_PREVIEW_MAX_BYTES = 400_000

function sanitizeWorkspaceRelativePath(p: string): string | null {
  const t = p.trim().replace(/^\.\/+/, '').replace(/\\/g, '/')
  if (!t || t.includes('..') || t.startsWith('/')) return null
  if (!/^[a-zA-Z0-9_./~-]+$/.test(t)) return null
  return t
}

export type WorkspacePathKind = 'file' | 'directory' | 'missing' | 'notfile'

export type WorkspaceGitCommitLine = {
  shortSha: string
  author: string
  date: string
  subject: string
}

function parseGitLogTabBlock(s: string): WorkspaceGitCommitLine[] {
  const out: WorkspaceGitCommitLine[] = []
  for (const line of s.split('\n')) {
    const t = line.trimEnd()
    if (!t.trim()) continue
    const parts = t.split('\t')
    if (parts.length < 4) continue
    const shortSha = parts[0]!
    const author = parts[1]!
    const date = parts[2]!
    const subject = parts.slice(3).join('\t')
    out.push({ shortSha, author, date, subject })
  }
  return out
}

/**
 * Read path metadata, optional file contents (base64 over exec), and recent git history for path.
 */
export async function getWorkspaceSelection(environmentId: string, relativePath: string): Promise<{
  path: string
  kind: WorkspacePathKind
  content: string | null
  contentTruncated: boolean
  gitLog: WorkspaceGitCommitLine[]
}> {
  const safe = sanitizeWorkspaceRelativePath(relativePath)
  if (!safe) {
    throw new Error('Invalid path')
  }

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const container = docker.getContainer(environment.containerId)
  let inspect: Awaited<ReturnType<typeof container.inspect>>
  try {
    inspect = await container.inspect()
  } catch {
    throw new Error('No container found for this environment')
  }

  if (!inspect.State?.Running) {
    if (environment.status === 'RUNNING' || environment.status === 'PROVISIONING') {
      await prisma.environment.update({ where: { id: environmentId }, data: { status: 'STOPPED' } }).catch(() => {})
    }
    throw new Error('Container is not active')
  }

  const max = WORKSPACE_PREVIEW_MAX_BYTES
  const readScript = [
    `cd "${WORKSPACE_ROOT}" 2>/dev/null || exit 1`,
    `P="$SYNARO_PATH"`,
    `if [ -d "$P" ]; then echo "SYNARO_KIND:directory"; exit 0; fi`,
    `if [ ! -e "$P" ]; then echo "SYNARO_KIND:missing"; exit 0; fi`,
    `if [ ! -f "$P" ]; then echo "SYNARO_KIND:notfile"; exit 0; fi`,
    `echo "SYNARO_KIND:file"`,
    `bytes=$(wc -c <"$P" 2>/dev/null || echo 0)`,
    `echo "SYNARO_BYTES:$bytes"`,
    `echo "---B64---"`,
    `if [ "$bytes" -gt ${max} ]; then dd if="$P" bs=${max} count=1 2>/dev/null | base64; else cat "$P" | base64; fi`,
    `echo`,
    `echo "---END_B64---"`,
    `if [ "$bytes" -gt ${max} ]; then echo "SYNARO_TRUNC:1"; else echo "SYNARO_TRUNC:0"; fi`,
  ].join('\n')

  const raw = await execShellInContainer(environment.containerId, readScript, [`SYNARO_PATH=${safe}`])

  let kind: WorkspacePathKind = 'missing'
  let content: string | null = null
  let contentTruncated = false

  const startB64 = raw.indexOf('---B64---')
  const endB64 = raw.indexOf('---END_B64---')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (t.startsWith('SYNARO_KIND:')) {
      const v = t.slice('SYNARO_KIND:'.length)
      if (v === 'file') kind = 'file'
      else if (v === 'directory') kind = 'directory'
      else if (v === 'missing') kind = 'missing'
      else if (v === 'notfile') kind = 'notfile'
    }
    if (t.startsWith('SYNARO_TRUNC:')) {
      contentTruncated = t.includes('1')
    }
  }

  if (kind === 'file' && startB64 !== -1 && endB64 !== -1 && endB64 > startB64) {
    const b64Block = raw.slice(startB64 + '---B64---'.length, endB64).replace(/\s/g, '')
    try {
      content = Buffer.from(b64Block, 'base64').toString('utf8')
    } catch {
      content = null
    }
  }

  let gitLog: WorkspaceGitCommitLine[] = []
  try {
    const gl = await execShellInContainer(
      environment.containerId,
      [
        `cd "${WORKSPACE_ROOT}" 2>/dev/null || exit 0`,
        `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0`,
        `P="$SYNARO_PATH"`,
        `git log -n 15 --format='%h\t%aN\t%ci\t%s' -- "$P" 2>/dev/null`,
      ].join('\n'),
      [`SYNARO_PATH=${safe}`],
    )
    gitLog = parseGitLogTabBlock(gl)
  } catch {
    gitLog = []
  }

  return { path: safe, kind, content, contentTruncated, gitLog }
}

/**
 * Write a file into the container workspace. Content is base64-encoded via env var to avoid
 * shell escaping issues. Max content size is limited by Docker env var limits (~1 MB in practice).
 */
export async function writeWorkspaceFile(environmentId: string, relativePath: string, content: string): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath)
  if (!safe) throw new Error('Invalid path')

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const fullPath = `${WORKSPACE_ROOT}/${safe}`
  const b64 = Buffer.from(content, 'utf8').toString('base64')

  await execShellInContainer(
    environment.containerId,
    `mkdir -p "$(dirname "$SYNARO_PATH")" && printf '%s' "$SYNARO_B64" | base64 -d > "$SYNARO_PATH"`,
    [`SYNARO_PATH=${fullPath}`, `SYNARO_B64=${b64}`],
  )
}

export async function createWorkspaceDirectory(environmentId: string, relativePath: string): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath)
  if (!safe) throw new Error('Invalid path')

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const fullPath = `${WORKSPACE_ROOT}/${safe}`
  await execShellInContainer(environment.containerId, `mkdir -p "$SYNARO_PATH"`, [`SYNARO_PATH=${fullPath}`])
}

export async function deleteWorkspacePath(environmentId: string, relativePath: string): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath)
  if (!safe) throw new Error('Invalid path')

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const fullPath = `${WORKSPACE_ROOT}/${safe}`
  await execShellInContainer(
    environment.containerId,
    `if test -e "$SYNARO_PATH"; then rm -rf "$SYNARO_PATH"; else exit 3; fi`,
    [`SYNARO_PATH=${fullPath}`],
  )
}

export async function renameWorkspacePath(
  environmentId: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const fromSafe = sanitizeWorkspaceRelativePath(fromPath)
  const toSafe = sanitizeWorkspaceRelativePath(toPath)
  if (!fromSafe || !toSafe) throw new Error('Invalid path')

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) throw new Error('No container found for this environment')
  if (environment.status !== 'RUNNING' && environment.status !== 'PROVISIONING') {
    throw new Error('Container is not active')
  }

  const fromFull = `${WORKSPACE_ROOT}/${fromSafe}`
  const toFull = `${WORKSPACE_ROOT}/${toSafe}`
  await execShellInContainer(
    environment.containerId,
    `if test -e "$SYNARO_FROM"; then mkdir -p "$(dirname "$SYNARO_TO")" && mv "$SYNARO_FROM" "$SYNARO_TO"; else exit 3; fi`,
    [`SYNARO_FROM=${fromFull}`, `SYNARO_TO=${toFull}`],
  )
}

const TERMINAL_MAX_COMMAND_LEN = 8_000
const TERMINAL_MAX_OUTPUT_BYTES = 96 * 1024

export type TerminalExecResult = {
  output: string
  exitCode: number | null
  cwd: string
}

/**
 * Run a shell command in the project container workspace (non-interactive exec).
 */
export async function execTerminalCommand(environmentId: string, command: string): Promise<TerminalExecResult> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING') {
    throw new Error('Container is not active')
  }

  const container = docker.getContainer(environment.containerId)
  let inspect: Awaited<ReturnType<typeof container.inspect>>
  try {
    inspect = await container.inspect()
  } catch {
    throw new Error('No container found for this environment')
  }
  if (!inspect.State?.Running) {
    await prisma.environment.update({ where: { id: environmentId }, data: { status: 'STOPPED' } }).catch(() => {})
    throw new Error('Container is not running')
  }

  const trimmed = command.replace(/\r\n/g, '\n').replace(/\r/g, '').trim()
  if (!trimmed) {
    return { output: '', exitCode: 0, cwd: WORKSPACE_ROOT }
  }
  if (trimmed.length > TERMINAL_MAX_COMMAND_LEN) {
    throw new Error(`Command too long (max ${TERMINAL_MAX_COMMAND_LEN} characters)`)
  }

  // Use `;` joins only — Alpine ash rejects `if … elif … fi cmd` on one line (space-joined).
  const workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)
  const script = [`cd "${workspaceDir}"`, trimmed].join('; ')

  const execInstance = await container.exec({
    Cmd: ['sh', '-c', script],
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
  })

  const stream = await execInstance.start({ hijack: true, stdin: false })
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  docker.modem.demuxStream(stream, stdout, stderr)

  const outChunks: Buffer[] = []
  const errChunks: Buffer[] = []
  stdout.on('data', (chunk: Buffer) => outChunks.push(chunk))
  stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

  await new Promise<void>((resolve, reject) => {
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })

  const exitInspect = await execInstance.inspect()
  let output = Buffer.concat([...outChunks, ...errChunks]).toString('utf8')
  output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (Buffer.byteLength(output, 'utf8') > TERMINAL_MAX_OUTPUT_BYTES) {
    output = `…(output truncated)\n${output.slice(-TERMINAL_MAX_OUTPUT_BYTES)}`
  }

  return {
    output: output.trimEnd(),
    exitCode: typeof exitInspect.ExitCode === 'number' ? exitInspect.ExitCode : null,
    cwd: workspaceDir,
  }
}

export type GitWorkspacePushInput = {
  accessToken: string
  /** Canonical https://github.com/owner/repo (no credentials). */
  gitRemoteUrl: string
  commitMessage: string
  authorName: string
  authorEmail: string
  /** Run `git init` when the workspace has no `.git` directory. */
  initIfNeeded?: boolean
}

export type GitWorkspacePushResult = {
  ok: boolean
  output: string
  branch: string
  commitSha: string | null
  noChanges?: boolean
}

function shellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

/** Collect git status and diff text for AI commit message generation (does not stage or commit). */
export async function getGitWorkspaceChangesSummary(environmentId: string): Promise<string> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING') {
    throw new Error('Container is not active')
  }

  const workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)
  const script = [
    'apk add --no-cache git >/dev/null 2>&1 || true',
    `cd ${shellSingleQuoted(workspaceDir)}`,
    'if GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then cd "$GIT_ROOT"; fi',
    'if ! git rev-parse --git-dir >/dev/null 2>&1; then echo "NO_GIT_REPO"; exit 0; fi',
    'echo "=== BRANCH ==="',
    'git branch --show-current 2>/dev/null || echo "unknown"',
    'echo "=== STATUS ==="',
    'git status -sb',
    'echo "=== DIFF STAT ==="',
    'git diff --stat HEAD 2>/dev/null || git diff --stat 2>/dev/null || true',
    'echo "=== UNTRACKED ==="',
    'git ls-files --others --exclude-standard 2>/dev/null | head -100',
    'echo "=== DIFF (truncated) ==="',
    '(git diff HEAD 2>/dev/null || git diff 2>/dev/null || true) | head -c 12000',
  ].join('\n')

  return execShellInContainer(environment.containerId, script)
}

/**
 * Stage all changes, commit, and push to GitHub using an OAuth token (non-interactive).
 */
export async function gitCommitAndPushWorkspace(
  environmentId: string,
  input: GitWorkspacePushInput,
): Promise<GitWorkspacePushResult> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING') {
    throw new Error('Container is not active')
  }

  const workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)
  const authRemote = toGithubAuthenticatedCloneUrl(input.gitRemoteUrl, input.accessToken)
  const commitMessage = input.commitMessage?.trim()
  if (!commitMessage) {
    throw new Error('Commit message is required')
  }
  const msgB64 = Buffer.from(commitMessage, 'utf8').toString('base64')
  const allowInit = input.initIfNeeded ? '1' : '0'

  const script = [
    'apk add --no-cache git >/dev/null 2>&1 || true',
    `cd ${shellSingleQuoted(workspaceDir)}`,
    'export GIT_TERMINAL_PROMPT=0',
    `ALLOW_INIT=${allowInit}`,
    'if GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then',
    '  cd "$GIT_ROOT" || exit 1',
    'elif [ "$ALLOW_INIT" = "1" ]; then',
    '  git init -b main',
    'else',
    '  echo "NO_GIT_REPO"; exit 2',
    'fi',
    `git config user.name ${shellSingleQuoted(input.authorName)}`,
    `git config user.email ${shellSingleQuoted(input.authorEmail)}`,
    'git add -A',
    'if git diff --cached --quiet 2>/dev/null; then echo "NO_CHANGES"; exit 0; fi',
    `git commit -m "$(printf %s ${shellSingleQuoted(msgB64)} | base64 -d)" || { echo "COMMIT_FAILED"; exit 1; }`,
    'BRANCH=$(git symbolic-ref -q --short HEAD 2>/dev/null || true)',
    'if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then',
    '  BRANCH=$(git remote show origin 2>/dev/null | sed -n "s/.*HEAD branch: //p" | tr -d "\\r")',
    'fi',
    '[ -z "$BRANCH" ] && BRANCH=main',
    `if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin ${shellSingleQuoted(authRemote)}; else git remote add origin ${shellSingleQuoted(authRemote)}; fi`,
    'if git rev-parse --is-shallow-repository 2>/dev/null | grep -q true; then git fetch --unshallow origin 2>/dev/null || git fetch origin 2>/dev/null || true; fi',
    'if ! git push -u origin "$BRANCH" 2>&1; then',
    '  git pull --rebase origin "$BRANCH" 2>&1 || true',
    '  git push -u origin "$BRANCH" 2>&1',
    'fi',
    'echo "COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo)"',
    'echo "BRANCH=$BRANCH"',
  ].join('\n')

  const output = await execShellInContainer(environment.containerId, script)
  const noChanges = output.includes('NO_CHANGES')
  const noGit = output.includes('NO_GIT_REPO')
  const branchMatch = output.match(/BRANCH=([^\n]+)/)
  const shaMatch = output.match(/COMMIT_SHA=([a-f0-9]+)/i)
  const branch = branchMatch?.[1]?.trim() || 'main'
  const commitSha = shaMatch?.[1]?.trim() || null

  if (noGit) {
    return { ok: false, output, branch, commitSha: null }
  }

  const pushFailed =
    /error:|fatal:|rejected|authentication failed|permission denied/i.test(output) &&
    !noChanges &&
    !output.includes('Everything up-to-date')

  return {
    ok: !pushFailed,
    output,
    branch,
    commitSha,
    noChanges,
  }
}
