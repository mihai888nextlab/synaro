import { Buffer } from 'node:buffer'

import { docker } from '../lib/docker.js'
import { prisma } from '../lib/prisma.js'
import {
  SYNARO_DOMAIN,
  TRAEFIK_NETWORK,
  buildTraefikLabels,
  execShellInContainer,
  waitUntilContainerRunning,
  workspaceVolumeName,
} from './docker.manager.js'

type DeploymentStatus = 'INACTIVE' | 'BUILDING' | 'RUNNING' | 'STOPPED' | 'ERROR'

// Deploy containers run a production build (e.g. `next build`), which OOMs at the 512 MB used for
// preview containers — give them more headroom. NOTE: a deployed project runs a SECOND container
// alongside its editing environment, so this doubles the per-project memory footprint on the host.
const DEPLOY_MEMORY_BYTES = 1024 * 1024 * 1024 // 1 GB
const DEPLOY_NANO_CPUS = 1_000_000_000 // 1 CPU
const BASE_IMAGE = 'node:20-alpine'

// Install + build + first boot can take several minutes (npm install + framework build).
const BUILD_TIMEOUT_MS = 8 * 60_000
const PORT_POLL_INTERVAL_MS = 2_000

// A top-level .py that opens a port ⇒ a long-running server we can keep up (mirrors run.ts).
const PY_SERVER_RE =
  'flask|fastapi|django|uvicorn|gunicorn|http\\.server|socketserver|bottle|aiohttp|serve_forever|socket\\(|app\\.run\\(|run_server|\\.listen\\('

/** Per-project Docker volume holding the frozen snapshot the deployment runs from. */
export function deployVolumeName(projectId: string): string {
  return `synaro-deploy-${projectId.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
}

/** Stable, collision-free deploy subdomain. Project slugs are globally unique, so no suffix is needed. */
export function buildDeploySubdomain(projectSlug: string): string {
  const slug = projectSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return slug || 'app'
}

/** Public URL for a deployment. Null in local-dev mode (no Traefik domain configured). */
export function deployPublicUrl(dep: { subdomain?: string | null }): string | null {
  if (SYNARO_DOMAIN && dep.subdomain) return `https://${dep.subdomain}.${SYNARO_DOMAIN}`
  return null
}

async function setStatus(
  projectId: string,
  status: DeploymentStatus,
  extra?: { containerId?: string | null; deployedAt?: Date; runCommand?: string | null; commitSha?: string | null },
) {
  return prisma.deployment.update({ where: { projectId }, data: { status, ...extra } })
}

async function ensureBaseImage(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    docker.pull(BASE_IMAGE, (err: Error, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err)
      docker.modem.followProgress(stream, (e: unknown) => (e ? reject(e) : resolve()))
    })
  })
}

/** Create + run a short-lived helper container, wait for it to exit, return its exit code and logs. */
async function runEphemeral(binds: string[], cmd: string): Promise<{ exitCode: number | null; output: string }> {
  const container = await docker.createContainer({
    Image: BASE_IMAGE,
    Cmd: ['sh', '-c', cmd],
    Tty: true, // plain (un-framed) logs
    HostConfig: { Binds: binds },
  })
  await container.start()
  let exitCode: number | null = null
  try {
    const status = (await container.wait()) as { StatusCode?: number }
    exitCode = typeof status.StatusCode === 'number' ? status.StatusCode : null
  } catch {
    exitCode = null
  }
  let output = ''
  try {
    const buf = (await container.logs({ stdout: true, stderr: true, tail: 4000 })) as unknown as Buffer
    output = buf.toString('utf8')
  } catch {
    /* ignore */
  }
  try {
    await container.remove({ force: true })
  } catch {
    /* ignore */
  }
  return { exitCode, output }
}

type DeployRuntime =
  | { language: 'node'; build: boolean; start: string }
  | { language: 'python'; entry: string }

/** Choose a production start command from package.json (prod-biased vs run.ts, which prefers dev). */
function resolveNodeRuntime(pkg: { scripts?: Record<string, string>; main?: string }): DeployRuntime {
  const scripts = pkg.scripts ?? {}
  const build = Boolean(scripts.build)
  let start: string
  if (scripts.start) start = 'npm start'
  else if (scripts.serve) start = 'npm run serve'
  else if (build && scripts.dev) start = 'npm run dev' // has a build but no start (rare) — fall back
  else if (pkg.main) start = `node ${pkg.main}`
  else if (scripts.dev) start = 'npm run dev' // dev-only app: still deployable, isolated + supervised
  else start = 'node index.js'
  return { language: 'node', build, start }
}

/**
 * Copy the current workspace into a fresh deploy volume (excluding node_modules/.next/.git) and probe
 * it to decide the runtime. Returns null when there is nothing runnable to deploy.
 */
async function snapshotAndProbe(projectId: string): Promise<DeployRuntime | null> {
  const srcVol = workspaceVolumeName(projectId)
  const dstVol = deployVolumeName(projectId)
  const cmd = [
    'rm -rf /dst/* /dst/.[!.]* 2>/dev/null || true',
    'if [ ! -d /src/app ]; then echo SYNARO_NO_SOURCE; exit 0; fi',
    'cd /src/app',
    'tar cf - --exclude=node_modules --exclude=.next --exclude=.git --exclude=.synaro-deploy-built . | (cd /dst && tar xf -) || { echo SYNARO_COPY_FAIL; exit 1; }',
    'cd /dst',
    'if [ -z "$(ls -A 2>/dev/null)" ]; then echo SYNARO_EMPTY; exit 0; fi',
    'if [ -f package.json ]; then echo SYNARO_PKG_START; cat package.json; echo; echo SYNARO_PKG_END; fi',
    'ENTRY=""; for f in main.py app.py server.py wsgi.py manage.py index.py run.py; do [ -f "$f" ] && ENTRY="$f" && break; done',
    '[ -z "$ENTRY" ] && ENTRY=$(ls *.py 2>/dev/null | head -n1)',
    'echo "SYNARO_PY_ENTRY:$ENTRY"',
    `if [ -n "$ENTRY" ] && ls *.py >/dev/null 2>&1 && grep -lE '${PY_SERVER_RE}' *.py >/dev/null 2>&1; then echo SYNARO_PY_SERVER; fi`,
  ].join('\n')

  const { output } = await runEphemeral([`${srcVol}:/src:ro`, `${dstVol}:/dst`], cmd)

  if (output.includes('SYNARO_NO_SOURCE') || output.includes('SYNARO_EMPTY')) return null

  const pkgStart = output.indexOf('SYNARO_PKG_START')
  const pkgEnd = output.indexOf('SYNARO_PKG_END')
  if (pkgStart !== -1 && pkgEnd > pkgStart) {
    const pkgRaw = output.slice(pkgStart + 'SYNARO_PKG_START'.length, pkgEnd).trim()
    try {
      const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string>; main?: string }
      return resolveNodeRuntime(pkg)
    } catch {
      // malformed package.json — treat as a plain node project
      return { language: 'node', build: false, start: 'node index.js' }
    }
  }

  // No package.json — only a long-running Python server can be kept always-up.
  const entry = (output.match(/SYNARO_PY_ENTRY:(.*)/)?.[1] ?? '').trim()
  if (entry && output.includes('SYNARO_PY_SERVER')) {
    return { language: 'python', entry }
  }
  return null
}

/** Build the supervised container command: build once (guarded by a marker), then exec the server. */
function buildDeployCmd(runtime: DeployRuntime): string {
  if (runtime.language === 'python') {
    return [
      'cd /app || exit 1',
      'if [ ! -f /app/.synaro-deploy-built ]; then',
      '  PY=$(command -v python3 || command -v python || true)',
      '  if [ -z "$PY" ]; then apk add --no-cache python3 py3-pip >/dev/null 2>&1 || true; fi',
      '  [ -f requirements.txt ] && { command -v pip3 >/dev/null 2>&1 || apk add --no-cache py3-pip >/dev/null 2>&1 || true; pip3 install -r requirements.txt >> /tmp/deploy.log 2>&1 || true; }',
      '  touch /app/.synaro-deploy-built',
      'fi',
      'PY=$(command -v python3 || command -v python)',
      `echo "[synaro-deploy] starting: python ${runtime.entry}" >> /tmp/deploy.log`,
      `PORT=3000 exec "$PY" ${runtime.entry} >> /tmp/deploy.log 2>&1`,
    ].join('\n')
  }

  const buildStep = runtime.build
    ? 'npm run build >> /tmp/deploy.log 2>&1 || { echo "[synaro-deploy] build failed" >> /tmp/deploy.log; exit 1; }'
    : 'true'
  return [
    'cd /app || exit 1',
    'if [ ! -f /app/.synaro-deploy-built ]; then',
    '  echo "[synaro-deploy] installing dependencies..." >> /tmp/deploy.log',
    '  (npm ci || npm install) >> /tmp/deploy.log 2>&1 || { echo "[synaro-deploy] install failed" >> /tmp/deploy.log; exit 1; }',
    `  ${buildStep}`,
    '  touch /app/.synaro-deploy-built',
    'fi',
    `echo "[synaro-deploy] starting: ${runtime.start}" >> /tmp/deploy.log`,
    `PORT=3000 exec ${runtime.start} >> /tmp/deploy.log 2>&1`,
  ].join('\n')
}

async function removeExistingContainer(containerId: string | null | undefined): Promise<void> {
  if (!containerId) return
  const c = docker.getContainer(containerId)
  try {
    await c.stop()
  } catch {
    /* already stopped */
  }
  try {
    await c.remove({ force: true })
  } catch {
    /* already gone */
  }
}

/** Poll for the app listening on container port 3000 (0xBB8 in /proc/net/tcp). */
async function waitForPort3000(containerId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const container = docker.getContainer(containerId)
  while (Date.now() < deadline) {
    try {
      const ins = await container.inspect()
      if (!ins.State?.Running) return false // container exited (build/start failed)
    } catch {
      return false
    }
    try {
      const out = await execShellInContainer(
        containerId,
        "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo READY || echo WAIT",
      )
      if (out.includes('READY')) return true
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, PORT_POLL_INTERVAL_MS))
  }
  return false
}

/** The heavy lifting: snapshot → build → run → wait for readiness. Runs in the background. */
async function runDeployPipeline(projectId: string): Promise<void> {
  try {
    const dep = await prisma.deployment.findUnique({ where: { projectId } })
    if (!dep) return

    await removeExistingContainer(dep.containerId)
    await ensureBaseImage()

    const runtime = await snapshotAndProbe(projectId)
    if (!runtime) {
      await setStatus(projectId, 'ERROR', {
        containerId: null,
        runCommand: 'Nothing to deploy: no package.json app or long-running Python server was found. Generate and run the project first.',
      })
      return
    }

    const runCommandLabel = runtime.language === 'python' ? `python ${runtime.entry}` : runtime.start
    const useTraefik = Boolean(SYNARO_DOMAIN)
    const subdomain = dep.subdomain ?? undefined

    const ownerLabels = { 'synaro.deployment.id': dep.id, 'synaro.project.id': projectId }
    const labels: Record<string, string> =
      useTraefik && subdomain
        ? buildTraefikLabels(`synaro-deploy-${dep.id}`, subdomain, ownerLabels)
        : { ...ownerLabels }

    const hostConfig: Record<string, unknown> = {
      Memory: DEPLOY_MEMORY_BYTES,
      NanoCpus: DEPLOY_NANO_CPUS,
      // Keep the deployment up across crashes and daemon/VPS restarts. `unless-stopped` means an
      // explicit `docker stop` (our Stop action) keeps it down until Start.
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: useTraefik ? TRAEFIK_NETWORK : 'bridge',
      Binds: [`${deployVolumeName(projectId)}:/app`],
    }
    // Local-dev fallback: no Traefik, so bind a host port for reachability (not used in prod).
    if (!useTraefik) {
      hostConfig.PortBindings = { '3000/tcp': [{ HostPort: '0' }] }
    }

    const container = await docker.createContainer({
      Image: BASE_IMAGE,
      WorkingDir: '/app',
      Cmd: ['sh', '-c', buildDeployCmd(runtime)],
      Labels: labels,
      HostConfig: hostConfig,
    })
    await container.start()

    const containerId = container.id
    await setStatus(projectId, 'BUILDING', { containerId, runCommand: runCommandLabel })

    const up = (await waitUntilContainerRunning(containerId, 30_000)) && (await waitForPort3000(containerId, BUILD_TIMEOUT_MS))
    if (!up) {
      // Stop it so `unless-stopped` doesn't crash-loop a failing build forever.
      try {
        await docker.getContainer(containerId).stop()
      } catch {
        /* ignore */
      }
      await setStatus(projectId, 'ERROR')
      return
    }

    await setStatus(projectId, 'RUNNING', { deployedAt: new Date() })
  } catch (err) {
    await setStatus(projectId, 'ERROR').catch(() => {})
    throw err
  }
}

export type DeployProjectOptions = { projectSlug: string; commitSha?: string | null }

/**
 * Kick off (or re-run) a production deployment. Returns immediately with the row in BUILDING; the
 * snapshot/build/run pipeline continues in the background (poll status via getDeployment).
 */
export async function deployProject(projectId: string, opts: DeployProjectOptions) {
  const subdomain = Boolean(SYNARO_DOMAIN) ? buildDeploySubdomain(opts.projectSlug) : null

  const existing = await prisma.deployment.findUnique({ where: { projectId } })
  if (existing?.status === 'BUILDING') return existing // already in flight — don't stack builds

  const dep = existing
    ? await prisma.deployment.update({
        where: { projectId },
        data: { status: 'BUILDING', subdomain: subdomain ?? existing.subdomain, commitSha: opts.commitSha ?? existing.commitSha },
      })
    : await prisma.deployment.create({
        data: { projectId, status: 'BUILDING', subdomain, commitSha: opts.commitSha ?? null },
      })

  // Fire and forget — the route responds 202 and the UI polls.
  runDeployPipeline(projectId).catch(() => {
    /* status already set to ERROR inside the pipeline */
  })

  return dep
}

export async function getDeployment(projectId: string) {
  return prisma.deployment.findUnique({ where: { projectId } })
}

export async function stopDeployment(projectId: string) {
  const dep = await prisma.deployment.findUnique({ where: { projectId } })
  if (!dep) throw new Error('No deployment found')
  if (dep.containerId) {
    try {
      await docker.getContainer(dep.containerId).stop()
    } catch {
      /* already stopped */
    }
  }
  return setStatus(projectId, 'STOPPED')
}

export async function startDeployment(projectId: string) {
  const dep = await prisma.deployment.findUnique({ where: { projectId } })
  if (!dep?.containerId) throw new Error('No deployment container to start')
  await setStatus(projectId, 'BUILDING')
  await docker.getContainer(dep.containerId).start()
  const up = (await waitUntilContainerRunning(dep.containerId, 30_000)) && (await waitForPort3000(dep.containerId, BUILD_TIMEOUT_MS))
  return setStatus(projectId, up ? 'RUNNING' : 'ERROR', up ? { deployedAt: new Date() } : undefined)
}

export async function destroyDeployment(projectId: string): Promise<void> {
  const dep = await prisma.deployment.findUnique({ where: { projectId } })
  if (!dep) return
  await removeExistingContainer(dep.containerId)
  try {
    await docker.getVolume(deployVolumeName(projectId)).remove({ force: true })
  } catch {
    /* volume may not exist */
  }
  await prisma.deployment.delete({ where: { projectId } }).catch(() => {})
}

export async function getDeployLogs(projectId: string): Promise<string[]> {
  const dep = await prisma.deployment.findUnique({ where: { projectId } })
  if (!dep?.containerId) return ['(no deployment logs yet)']
  try {
    const out = await execShellInContainer(dep.containerId, "tail -n 200 /tmp/deploy.log 2>/dev/null || echo '(no logs yet)'")
    return out.split('\n')
  } catch {
    return ['(could not fetch deployment logs)']
  }
}

/** Flip a stale RUNNING row to ERROR when its container is no longer running (crash loop / gone). */
export async function reconcileDeployment(projectId: string): Promise<void> {
  const dep = await prisma.deployment.findUnique({ where: { projectId } })
  if (!dep || dep.status !== 'RUNNING' || !dep.containerId) return
  try {
    const ins = await docker.getContainer(dep.containerId).inspect()
    if (!ins.State?.Running) await setStatus(projectId, 'ERROR').catch(() => {})
  } catch {
    await setStatus(projectId, 'ERROR').catch(() => {})
  }
}
