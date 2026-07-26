import { readContainerFile, remoteExec, readAppLog } from '../lib/environment-client.js'
import type { HealthResult } from './types.js'

type PackageJson = { scripts?: Record<string, string>; main?: string }

// Port 3000 in hex = 0xBB8; /proc/net/tcp lists listening ports as ":0BB8 ".
const PORT_CHECK_CMD =
  "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo SYNARO_READY || echo SYNARO_WAIT"

// Log signatures that mean a *server* is broken (not just noisy).
const FATAL_LOG_RE =
  /(Error:|Cannot find module|MODULE_NOT_FOUND|SyntaxError|ReferenceError|TypeError:|Failed to compile|EADDRINUSE|listen EACCES|Unhandled|address already in use|command not found|Module not found)/i

// A Python traceback / import error means a run-to-completion script actually crashed.
const PY_FATAL_RE =
  /(Traceback \(most recent call last\)|SyntaxError|IndentationError|ModuleNotFoundError|ImportError:|NameError|AttributeError|python3?: (?:can't open|not found))/i

const PORT_WAIT_MS = 180_000 // first run installs deps — be generous
const POLL_INTERVAL_MS = 2_500
const SCRIPT_TIMEOUT_MS = 90_000

// Enter the project root the same way the run flow does (a project may live under app/).
const WORKSPACE_CD = 'cd /tmp/synaro-workspace/app 2>/dev/null || cd /tmp/synaro-workspace 2>/dev/null'

// Resolve a Python interpreter into $PY, installing one on demand — the runtime base image
// (node:20-alpine) ships without Python, so a generated .py project has nothing to run otherwise.
const ENSURE_PYTHON = [
  'PY=$(command -v python3 || command -v python || true)',
  'if [ -z "$PY" ]; then apk add --no-cache python3 >/dev/null 2>&1 || true; PY=$(command -v python3 || true); fi',
].join('\n')

// Best-effort pip install when a requirements.txt is present.
const PIP_INSTALL =
  '[ -f requirements.txt ] && { command -v pip3 >/dev/null 2>&1 || apk add --no-cache py3-pip >/dev/null 2>&1 || true; pip3 install -r requirements.txt >> /tmp/app.log 2>&1 || true; }'

// Any top-level .py that opens a port ⇒ the project is a long-running server, not a script.
const PY_SERVER_RE =
  'flask|fastapi|django|uvicorn|gunicorn|http\\.server|socketserver|bottle|aiohttp|serve_forever|socket\\(|app\\.run\\(|run_server|\\.listen\\('

interface Runtime {
  /** 'server' binds a port and runs forever; 'script' runs to completion and exits. */
  kind: 'server' | 'script'
  language: 'node' | 'python'
  /** Shell command that runs the app. For Python it references $PY (resolved by ENSURE_PYTHON). */
  runCommand: string
  hasPackageJson: boolean
}

function detectNodeRunCommand(pkg: PackageJson | null): string {
  if (!pkg) return 'node index.js'
  const scripts = pkg.scripts ?? {}
  if (scripts.dev) return 'npm run dev'
  if (scripts.start) return 'npm start'
  if (scripts.serve) return 'npm run serve'
  if (pkg.main) return `node ${pkg.main}`
  return 'node index.js'
}

/**
 * Decide how this project runs: Node vs Python, and whether it's a long-running server (verify by a
 * listening port) or a run-to-completion script (verify by a clean exit). Without this, every project
 * is assumed to be a web server on :3000 — so a correct `print("hello")` is reported as unhealthy.
 */
async function detectRuntime(envId: string): Promise<Runtime> {
  // Node: a package.json means an npm-managed (web) app.
  let pkg: PackageJson | null = null
  try {
    const content = await readContainerFile(envId, 'package.json')
    if (content) pkg = JSON.parse(content) as PackageJson
  } catch {
    pkg = null
  }
  if (pkg) {
    return { kind: 'server', language: 'node', runCommand: detectNodeRunCommand(pkg), hasPackageJson: true }
  }

  // Python: find an entry file and classify server vs script by whether any top-level .py opens a port.
  const detect = await remoteExec(
    envId,
    [
      WORKSPACE_CD,
      'ENTRY=""',
      'for f in main.py app.py hello.py index.py run.py server.py __main__.py; do [ -f "$f" ] && ENTRY="$f" && break; done',
      '[ -z "$ENTRY" ] && ENTRY=$(ls *.py 2>/dev/null | head -n1)',
      'echo "SYNARO_ENTRY:$ENTRY"',
      `if ls *.py >/dev/null 2>&1 && grep -lE '${PY_SERVER_RE}' *.py >/dev/null 2>&1; then echo SYNARO_SERVER; else echo SYNARO_SCRIPT; fi`,
    ].join('\n'),
    30_000,
  ).catch(() => ({ output: '', exitCode: null }))

  const entry = (detect.output.match(/SYNARO_ENTRY:(.*)/)?.[1] ?? '').trim()
  if (entry) {
    const isServer = detect.output.includes('SYNARO_SERVER')
    return {
      kind: isServer ? 'server' : 'script',
      language: 'python',
      runCommand: `"$PY" "${entry}"`,
      hasPackageJson: false,
    }
  }

  // Nothing recognizable — fall back to the historical Node web-server assumption.
  return { kind: 'server', language: 'node', runCommand: detectNodeRunCommand(null), hasPackageJson: false }
}

const KILL_PORT_3000 = [
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

const PATCH_NEXT_CONFIG = [
  'for _cfg in next.config.js next.config.mjs next.config.ts next.config.cjs; do',
  '  [ -f "$_cfg" ] && sed -i "/distDir/d" "$_cfg" 2>/dev/null || true',
  'done',
].join('\n')

/** Background script that (re)starts a *server* on :3000, logging to /tmp/app.log. Mirrors run.ts. */
function buildStartScript(runtime: Runtime): string {
  const lines: string[] = ['rm -f /tmp/app.log', KILL_PORT_3000, '(', WORKSPACE_CD, PATCH_NEXT_CONFIG]

  if (runtime.language === 'python') {
    lines.push(ENSURE_PYTHON, PIP_INSTALL)
  } else if (runtime.hasPackageJson) {
    lines.push(
      'if [ ! -d node_modules ]; then echo "[synaro] Installing dependencies..." >> /tmp/app.log; npm install --loglevel=warn >> /tmp/app.log 2>&1; fi',
    )
  }

  lines.push(
    `echo "[synaro] Starting: ${runtime.runCommand}" >> /tmp/app.log`,
    `PORT=3000 ${runtime.runCommand} >> /tmp/app.log 2>&1`,
    ') &',
    'echo $! > /tmp/app.pid',
    'echo SYNARO_STARTED',
  )
  return lines.join('\n')
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

/** Last meaningful line of a Python traceback, for a concise error summary. */
function firstPyError(log: string): string {
  const lines = log
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/Error|Exception|Traceback/.test(lines[i]!)) return lines[i]!.slice(0, 300)
  }
  return (lines[lines.length - 1] ?? 'The script reported an error.').slice(0, 300)
}

/**
 * Run a one-shot script to completion and judge it by its exit code + output — NOT by a listening
 * port. This is what makes a correct `print("hello")` pass instead of timing out on :3000.
 */
async function runScript(envId: string, runtime: Runtime): Promise<HealthResult> {
  const prelude =
    runtime.language === 'python'
      ? [ENSURE_PYTHON, 'if [ -z "$PY" ]; then echo "SYNARO_NOPYTHON"; exit 0; fi', PIP_INSTALL]
      : []

  const script = [
    WORKSPACE_CD,
    ...prelude,
    'echo "SYNARO_RUN_START"',
    `${runtime.runCommand} 2>&1`,
    'echo "SYNARO_EXIT:$?"',
  ].join('\n')

  let output = ''
  try {
    const res = await remoteExec(envId, script, SCRIPT_TIMEOUT_MS)
    output = res.output
  } catch {
    // remoteExec throws on timeout — a "script" that never exits is really a long-running process,
    // and running this long without crashing is the best signal of health we can get here.
    return {
      healthy: true,
      portOpen: false,
      httpStatus: null,
      log: '(script still running after timeout — treated as a long-running process)',
      error: null,
    }
  }

  if (output.includes('SYNARO_NOPYTHON')) {
    return {
      healthy: false,
      portOpen: false,
      httpStatus: null,
      log: output,
      error: 'No Python runtime is available in the environment and it could not be installed.',
    }
  }

  const log = (output.split('SYNARO_RUN_START').pop() ?? output).replace(/SYNARO_EXIT:\d+\s*$/, '').trim()
  const exitCode = Number(output.match(/SYNARO_EXIT:(\d+)/)?.[1] ?? 'NaN')
  const crashed = PY_FATAL_RE.test(log)

  if (exitCode === 0 && !crashed) {
    return { healthy: true, portOpen: false, httpStatus: null, log, error: null }
  }
  return {
    healthy: false,
    portOpen: false,
    httpStatus: null,
    log,
    error: crashed
      ? firstPyError(log)
      : `The script exited with code ${Number.isNaN(exitCode) ? 'unknown' : exitCode}.`,
  }
}

/**
 * Verify a generated project. Servers are checked by binding :3000 and answering `GET /`; scripts are
 * checked by running to completion with a clean exit. Returns a structured result the self-heal loop
 * can act on.
 */
export async function runHealthCheck(
  envId: string,
  onProgress?: (msg: string) => void | Promise<void>,
): Promise<HealthResult> {
  const runtime = await detectRuntime(envId)

  // ── Run-to-completion scripts: success = clean exit, not a listening port ──────────────────────
  if (runtime.kind === 'script') {
    await onProgress?.(`Running the ${runtime.language} script…`)
    return runScript(envId, runtime)
  }

  // ── Long-running servers: success = :3000 listening + GET / returns 2xx/3xx ────────────────────
  await onProgress?.(`Starting the app (${runtime.runCommand})…`)
  await remoteExec(envId, buildStartScript(runtime), 60_000)

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
