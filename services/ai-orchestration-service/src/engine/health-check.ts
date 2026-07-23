import { readContainerFile, remoteExec, readAppLog } from '../lib/environment-client.js'
import type { HealthResult } from './types.js'

type PackageJson = { scripts?: Record<string, string>; main?: string }

// Port 3000 in hex = 0xBB8; /proc/net/tcp lists listening ports as ":0BB8 ".
const PORT_CHECK_CMD =
  "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo SYNARO_READY || echo SYNARO_WAIT"

// Log signatures that mean the dev server is broken (not just noisy).
const FATAL_LOG_RE =
  /(Error:|Cannot find module|MODULE_NOT_FOUND|SyntaxError|ReferenceError|TypeError:|Failed to compile|EADDRINUSE|listen EACCES|Unhandled|address already in use|command not found|Module not found)/i

const PORT_WAIT_MS = 180_000 // first run installs deps — be generous
const POLL_INTERVAL_MS = 2_500

function detectRunCommand(pkg: PackageJson | null): string {
  if (!pkg) return 'node index.js'
  const scripts = pkg.scripts ?? {}
  if (scripts.dev) return 'npm run dev'
  if (scripts.start) return 'npm start'
  if (scripts.serve) return 'npm run serve'
  if (pkg.main) return `node ${pkg.main}`
  return 'node index.js'
}

/** Background script that (re)starts the dev server on :3000, logging to /tmp/app.log. Mirrors run.ts. */
function buildStartScript(runCommand: string, hasPackageJson: boolean): string {
  const installStep = hasPackageJson
    ? '([ -d node_modules ] || (echo "[synaro] Installing dependencies..." >> /tmp/app.log && npm install --loglevel=warn >> /tmp/app.log 2>&1)) && '
    : ''

  const killPort3000 = [
    'INODE=$(awk "NR>1 && \\$2 ~ /:0BB8/ {print \\$10}" /proc/net/tcp /proc/net/tcp6 2>/dev/null | head -1)',
    'if [ -n "$INODE" ]; then',
    '  for piddir in /proc/[0-9]*/fd; do',
    '    if ls -la "$piddir" 2>/dev/null | grep -q "socket:\\[$INODE\\]"; then',
    '      PID=${piddir%/fd}; PID=${PID#/proc/}',
    '      kill -9 "$PID" 2>/dev/null || true',
    '    fi',
    '  done',
    'fi',
  ].join('\n')

  const patchNextConfig = [
    'for _cfg in next.config.js next.config.mjs next.config.ts next.config.cjs; do',
    '  [ -f "$_cfg" ] && sed -i "/distDir/d" "$_cfg" 2>/dev/null || true',
    'done',
  ].join('\n')

  return [
    'rm -f /tmp/app.log',
    killPort3000,
    `(cd /tmp/synaro-workspace/app 2>/dev/null || cd /tmp/synaro-workspace 2>/dev/null; ${patchNextConfig} && ${installStep}echo "[synaro] Starting: ${runCommand}" >> /tmp/app.log && PORT=3000 ${runCommand} >> /tmp/app.log 2>&1) &`,
    'echo $! > /tmp/app.pid',
    'echo SYNARO_STARTED',
  ].join('\n')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** In-container HTTP probe of the running app; returns the status code or null. */
async function probeHttp(envId: string): Promise<number | null> {
  const cmd =
    "node -e \"fetch('http://localhost:3000/').then(r=>process.stdout.write('HTTP:'+r.status)).catch(e=>process.stdout.write('HTTP_ERR:'+(e.code||e.message)))\""
  try {
    const { output } = await remoteExec(envId, cmd, 35_000)
    const m = output.match(/HTTP:(\d{3})/)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

/**
 * Start the app and verify it: dev server binds :3000, no fatal errors in the log, and `GET /`
 * returns a 2xx/3xx. Returns a structured result the self-heal loop can act on.
 */
export async function runHealthCheck(
  envId: string,
  onProgress?: (msg: string) => void | Promise<void>,
): Promise<HealthResult> {
  let pkg: PackageJson | null = null
  try {
    const content = await readContainerFile(envId, 'package.json')
    if (content) pkg = JSON.parse(content) as PackageJson
  } catch {
    pkg = null
  }

  const runCommand = detectRunCommand(pkg)
  await onProgress?.(`Starting the app (${runCommand})…`)
  await remoteExec(envId, buildStartScript(runCommand, pkg !== null), 60_000)

  // Poll until :3000 is listening or the app crashes on boot.
  const deadline = Date.now() + PORT_WAIT_MS
  let portOpen = false
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    try {
      const { output } = await remoteExec(envId, PORT_CHECK_CMD, 15_000)
      if (output.includes('SYNARO_READY')) {
        portOpen = true
        break
      }
    } catch {
      // transient exec failure — keep polling
    }
    // Bail early if the log already shows a fatal crash.
    const log = await readAppLog(envId).catch(() => '')
    if (FATAL_LOG_RE.test(log)) {
      return { healthy: false, portOpen: false, httpStatus: null, log, error: firstFatalLine(log) }
    }
  }

  const log = await readAppLog(envId).catch(() => '')

  if (!portOpen) {
    return {
      healthy: false,
      portOpen: false,
      httpStatus: null,
      log,
      error: FATAL_LOG_RE.test(log)
        ? firstFatalLine(log)
        : 'The dev server did not start listening on port 3000 in time.',
    }
  }

  await onProgress?.('Checking the app responds…')
  const httpStatus = await probeHttp(envId)
  const httpOk = httpStatus !== null && httpStatus >= 200 && httpStatus < 400
  const logFatal = FATAL_LOG_RE.test(log)

  if (httpOk && !logFatal) {
    return { healthy: true, portOpen: true, httpStatus, log, error: null }
  }

  return {
    healthy: false,
    portOpen: true,
    httpStatus,
    log,
    error: logFatal
      ? firstFatalLine(log)
      : `The app responded with HTTP ${httpStatus ?? 'no response'} instead of a success status.`,
  }
}

/** First log line matching the fatal signature, for a concise error summary. */
function firstFatalLine(log: string): string {
  for (const line of log.split('\n')) {
    if (FATAL_LOG_RE.test(line)) return line.trim().slice(0, 300)
  }
  return 'The dev server reported an error on startup.'
}
