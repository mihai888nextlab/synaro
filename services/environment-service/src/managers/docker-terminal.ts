import { docker } from '../lib/docker.js'
import { prisma } from '../lib/prisma.js'
import { resolveTerminalWorkspaceDir } from './docker.manager.js'

export type ContainerTerminalSession = {
  write: (data: Buffer) => void
  resize: (cols: number, rows: number) => Promise<void>
  close: () => void
}

/**
 * Attach an interactive TTY shell (`/bin/sh`) to the project container.
 * Stdin/stdout are raw terminal bytes (for xterm.js over WebSocket).
 */
export async function attachContainerInteractiveTerminal(
  environmentId: string,
  onData: (chunk: Buffer) => void,
  onExit: (exitCode: number | null) => void,
): Promise<ContainerTerminalSession> {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } })
  if (!environment?.containerId) {
    throw new Error('No container found for this environment')
  }
  if (environment.status !== 'RUNNING') {
    throw new Error('Container is not active')
  }

  const container = docker.getContainer(environment.containerId)
  const inspect = await container.inspect()
  if (!inspect.State?.Running) {
    await prisma.environment.update({ where: { id: environmentId }, data: { status: 'STOPPED' } }).catch(() => {})
    throw new Error('Container is not running')
  }

  const workspaceDir = await resolveTerminalWorkspaceDir(environment.containerId)

  const exec = await container.exec({
    Cmd: ['sh', '-c', 'exec /bin/sh -i'],
    WorkingDir: workspaceDir,
    Env: [
      'TERM=xterm-256color',
      `HOME=${workspaceDir}`,
      // Show full path instead of `~` (root), so the shell feels anchored to the project tree.
      'PS1=\\w # ',
    ],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  })

  const stream = await exec.start({ hijack: true, stdin: true })
  let closed = false

  const finish = async () => {
    if (closed) return
    closed = true
    try {
      const result = await exec.inspect()
      onExit(typeof result.ExitCode === 'number' ? result.ExitCode : null)
    } catch {
      onExit(null)
    }
  }

  stream.on('data', (chunk: Buffer) => {
    onData(chunk)
  })
  stream.on('end', () => {
    void finish()
  })
  stream.on('error', () => {
    void finish()
  })

  return {
    write: (data: Buffer) => {
      if (!closed) stream.write(data)
    },
    resize: async (cols: number, rows: number) => {
      if (closed) return
      const w = Math.max(1, Math.min(500, Math.floor(cols)))
      const h = Math.max(1, Math.min(200, Math.floor(rows)))
      await exec.resize({ w, h })
    },
    close: () => {
      if (closed) return
      closed = true
      try {
        stream.destroy()
      } catch {
        /* ignore */
      }
    },
  }
}
