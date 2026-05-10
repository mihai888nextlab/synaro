import { docker } from '../lib/docker.js'
import { prisma } from '../lib/prisma.js'

type EnvironmentStatus = 'INACTIVE' | 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'ERROR'
const BASE_PORT = 4000
const MAX_PORT = 4999

// Find a free port in our range by checking existing environments
async function allocatePort(): Promise<number> {
  const used = await prisma.environment.findMany({
    where: { port: { not: null } },
    select: { port: true },
  })
  const usedPorts = new Set(used.map((e: any) => e.port))
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

export async function createEnvironment(projectId: string, image: string = 'node:20-alpine') {
  const environment = await prisma.environment.create({
    data: { projectId, image, status: 'PROVISIONING' },
  })

  try {
    const port = await allocatePort()

    // Pull image if not present
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err: any) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })

    const container = await docker.createContainer({
      Image: image,
      Cmd: ['sh', '-c', 'echo "Environment ready" && tail -f /dev/null'],
      Labels: {
        'synaro.environment.id': environment.id,
        'synaro.project.id': projectId,
      },
      HostConfig: {
        PortBindings: { '3000/tcp': [{ HostPort: String(port) }] },
        Memory: 512 * 1024 * 1024,   // 512MB
        NanoCpus: 500_000_000,        // 0.5 CPU
        NetworkMode: 'bridge',
      },
    })

    await container.start()

    return updateStatus(environment.id, 'RUNNING', {
      containerId: container.id,
      port,
    })
  } catch (err) {
    await updateStatus(environment.id, 'ERROR')
    throw err
  }
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

export async function getContainerStats(id: string) {
  const environment = await prisma.environment.findUnique({ where: { id } })
  if (!environment?.containerId) throw new Error('No container found')

  const container = docker.getContainer(environment.containerId)
  const stats = await container.stats({ stream: false })
  return stats
}
