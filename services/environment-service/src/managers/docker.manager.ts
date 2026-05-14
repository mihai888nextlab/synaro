import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'

import { docker } from '../lib/docker.js'
import { prisma } from '../lib/prisma.js'
import { toGithubAuthenticatedCloneUrl, toPublicGitCloneUrl } from '../lib/git-clone.js'

type EnvironmentStatus = 'INACTIVE' | 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'ERROR'
const BASE_PORT = 4000
const MAX_PORT = 4999
/** Workspace root inside the environment container (matches `git clone … app`). */
const WORKSPACE_ROOT = '/tmp/synaro-workspace/app'

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

async function updateStatus(id: string, status: EnvironmentStatus, extra?: { containerId?: string; port?: number }) {
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
    const port = await allocatePort()

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
        'if git clone --depth 1 "$SYNARO_GIT_CLONE_URL" app; then touch .synaro-clone-ok; ' +
        'else touch .synaro-clone-failed; fi; ' +
        'exec tail -f /dev/null'
    } else {
      // Same layout as git clone (`…/app`) so folder uploads and `putArchive` have a target directory.
      cmd = 'mkdir -p /tmp/synaro-workspace/app && echo "Environment ready" && exec tail -f /dev/null'
    }

    const container = await docker.createContainer({
      Image: image,
      Cmd: ['sh', '-c', cmd],
      Env: env,
      Labels: {
        'synaro.environment.id': environment.id,
        'synaro.project.id': projectId,
      },
      HostConfig: {
        PortBindings: { '3000/tcp': [{ HostPort: String(port) }] },
        Memory: 512 * 1024 * 1024, // 512MB
        NanoCpus: 500_000_000, // 0.5 CPU
        NetworkMode: 'bridge',
      },
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
      port,
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

export async function destroyEnvironment(id: string) {
  const environment = await prisma.environment.findUnique({ where: { id } })

  if (environment?.containerId) {
    const container = docker.getContainer(environment.containerId)
    try {
      await container.stop()
    } catch {
      // container may already be stopped
    }
    await container.remove()
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
  const script = [
    `if [ ! -d "${WORKSPACE_ROOT}" ]; then exit 0; fi`,
    `cd "${WORKSPACE_ROOT}" 2>/dev/null || exit 0`,
    `find . -name .git -prune -o -name node_modules -prune -o -name .next -prune -o -name dist -prune -o -name build -prune -o -type f -print 2>/dev/null | LC_ALL=C sort | head -n ${
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
  const paths = (truncated ? lines.slice(0, WORKSPACE_LIST_MAX) : lines).map((l) =>
    l.replace(/^\.\//, ''),
  )

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
