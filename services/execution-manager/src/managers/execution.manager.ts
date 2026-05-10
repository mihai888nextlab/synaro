import { docker } from '../lib/docker.js'
import { prisma } from '../lib/prisma.js'

const PROJECTS_PATH = process.env.PROJECTS_VOLUME_PATH ?? '/var/lib/docker/volumes/synaro_projects_data/_data'

async function updateStatus(id: string, status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR', extra?: Record<string, unknown>) {
  return prisma.execution.update({
    where: { id },
    data: { status, ...extra },
  })
}

export async function createExecution(projectId: string, port: number) {
  const execution = await prisma.execution.create({
    data: { projectId, status: 'STARTING' },
  })

  try {
    const container = await docker.createContainer({
      Image: 'node:20-alpine',
      Cmd: ['sh', '-c', 'cd /app && rm -rf node_modules package-lock.json && npm install && npm start'],
      Env: [`PORT=3000`],
      Labels: {
        'synaro.execution.id': execution.id,
        'synaro.project.id': projectId,
      },
      HostConfig: {
        Binds: [`${PROJECTS_PATH}/${projectId}:/app`],
        PortBindings: { '3000/tcp': [{ HostPort: String(port) }] },
        Memory: 512 * 1024 * 1024,
        NanoCpus: 500_000_000,
        NetworkMode: 'bridge',
      },
    })

    await container.start()

    return updateStatus(execution.id, 'RUNNING', {
      containerId: container.id,
      port,
      startedAt: new Date(),
    })
  } catch (err) {
    await updateStatus(execution.id, 'ERROR')
    throw err
  }
}

export async function stopExecution(id: string) {
  const execution = await prisma.execution.findUnique({ where: { id } })
  if (!execution?.containerId) throw new Error('No container found')

  const container = docker.getContainer(execution.containerId)
  await container.stop()

  return updateStatus(id, 'STOPPED', { stoppedAt: new Date() })
}

export async function destroyExecution(id: string) {
  const execution = await prisma.execution.findUnique({ where: { id } })

  if (execution?.containerId) {
    const container = docker.getContainer(execution.containerId)
    try {
      await container.stop()
    } catch {
      // container may already be stopped
    }
    await container.remove()
  }

  return prisma.execution.delete({ where: { id } })
}

export async function getExecutionLogs(id: string) {
  const execution = await prisma.execution.findUnique({ where: { id } })
  if (!execution?.containerId) throw new Error('No container found')

  const container = docker.getContainer(execution.containerId)
  const buffer = await container.logs({
    tail: 100,
    stdout: true,
    stderr: true,
  })

  const lines: string[] = []
  let offset = 0
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset + 4)
    offset += 8
    const line = buffer.toString('utf8', offset, offset + length).replace(/\n$/, '')
    lines.push(line)
    offset += length
  }

  return { logs: lines }
}
