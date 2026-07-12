import type {
  V1Deployment,
  V1Ingress,
  V1Service,
} from '@kubernetes/client-node'

import { MOCK_K8S, requireK8s } from '../lib/k8s.js'
import { logger } from '../lib/logger.js'

const NAMESPACE = process.env.K8S_NAMESPACE ?? 'synaro-projects'
const SYNARO_DOMAIN = process.env.SYNARO_DOMAIN ?? 'synaro.ro'
const PROJECTS_PATH = process.env.PROJECTS_PATH ?? '/projects'

export type ProjectStatus = 'RUNNING' | 'STOPPED' | 'PROVISIONING'

/** K8s resource name for a project. DNS-1123: lowercase alphanumeric + hyphens, <=63 chars. */
function projectResourceName(projectId: string): string {
  return `project-${projectId.toLowerCase()}`
}

function projectSubdomain(projectId: string): string {
  return `${projectId.toLowerCase()}.${SYNARO_DOMAIN}`
}

/** Normalize the HTTP status across client-node v1 (ApiException.code) and older shapes. */
function httpStatus(err: unknown): number | undefined {
  const e = err as { code?: unknown; statusCode?: unknown; response?: { statusCode?: unknown } }
  const raw = e?.code ?? e?.statusCode ?? e?.response?.statusCode
  return typeof raw === 'number' ? raw : undefined
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ── Resource builders ────────────────────────────────────────────────────────

function buildDeployment(projectId: string): V1Deployment {
  const name = projectResourceName(projectId)
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace: NAMESPACE,
      labels: { app: name, 'synaro/project-id': projectId },
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name, 'synaro/project-id': projectId } },
        spec: {
          containers: [
            {
              name: 'project',
              image: 'node:20-alpine',
              command: [
                'sh',
                '-c',
                'cd /app && rm -rf node_modules package-lock.json && npm install && npm start',
              ],
              env: [{ name: 'PORT', value: '3000' }],
              ports: [{ containerPort: 3000 }],
              volumeMounts: [{ name: 'project-files', mountPath: '/app' }],
              resources: {
                requests: { memory: '128Mi', cpu: '100m' },
                limits: { memory: '512Mi', cpu: '500m' },
              },
              readinessProbe: {
                httpGet: { path: '/health', port: 3000 },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                failureThreshold: 5,
              },
            },
          ],
          volumes: [
            {
              name: 'project-files',
              hostPath: {
                path: `${PROJECTS_PATH}/${projectId}`,
                type: 'DirectoryOrCreate',
              },
            },
          ],
        },
      },
    },
  }
}

function buildService(projectId: string): V1Service {
  const name = projectResourceName(projectId)
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name, namespace: NAMESPACE },
    spec: {
      type: 'ClusterIP',
      selector: { app: name },
      ports: [{ port: 3000, targetPort: 3000 }],
    },
  }
}

function buildIngress(projectId: string): V1Ingress {
  const name = projectResourceName(projectId)
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name,
      namespace: NAMESPACE,
      annotations: { 'traefik.ingress.kubernetes.io/router.entrypoints': 'web' },
    },
    spec: {
      rules: [
        {
          host: projectSubdomain(projectId),
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: { service: { name, port: { number: 3000 } } },
              },
            ],
          },
        },
      ],
    },
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/** Create the Deployment + Service + Ingress for a project. Idempotent (409 → ok). */
export async function createProjectDeployment(
  projectId: string,
): Promise<{ subdomain: string }> {
  const name = projectResourceName(projectId)
  const subdomain = projectSubdomain(projectId)

  if (MOCK_K8S) {
    logger.info({ projectId, name, namespace: NAMESPACE, subdomain }, '[mock-k8s] createProjectDeployment: would create Deployment + Service + Ingress')
    return { subdomain }
  }

  const { apps, core, net } = requireK8s()

  const create = async (kind: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      logger.info({ projectId, name, kind }, 'k8s: created resource')
    } catch (err) {
      if (httpStatus(err) === 409) {
        logger.info({ projectId, name, kind }, 'k8s: resource already exists, continuing')
        return
      }
      throw new Error(`Failed to create ${kind} for ${name}: ${describe(err)}`)
    }
  }

  await create('Deployment', () => apps.createNamespacedDeployment({ namespace: NAMESPACE, body: buildDeployment(projectId) }))
  await create('Service', () => core.createNamespacedService({ namespace: NAMESPACE, body: buildService(projectId) }))
  await create('Ingress', () => net.createNamespacedIngress({ namespace: NAMESPACE, body: buildIngress(projectId) }))

  return { subdomain }
}

async function scaleDeployment(projectId: string, replicas: number): Promise<void> {
  const name = projectResourceName(projectId)

  if (MOCK_K8S) {
    logger.info({ projectId, name, replicas }, `[mock-k8s] scaleDeployment: would scale to ${replicas}`)
    return
  }

  const { apps } = requireK8s()
  try {
    const scale = await apps.readNamespacedDeploymentScale({ name, namespace: NAMESPACE })
    scale.spec = { ...scale.spec, replicas }
    await apps.replaceNamespacedDeploymentScale({ name, namespace: NAMESPACE, body: scale })
    logger.info({ projectId, name, replicas }, 'k8s: scaled deployment')
  } catch (err) {
    throw new Error(`Failed to scale ${name} to ${replicas}: ${describe(err)}`)
  }
}

/** Scale the Deployment to 0 (keeps the resources for a later start). */
export async function stopProjectDeployment(projectId: string): Promise<void> {
  return scaleDeployment(projectId, 0)
}

/** Scale the Deployment back to 1. */
export async function startProjectDeployment(projectId: string): Promise<void> {
  return scaleDeployment(projectId, 1)
}

/** Delete the Ingress, Service and Deployment. Ignores 404 (already gone). */
export async function destroyProjectDeployment(projectId: string): Promise<void> {
  const name = projectResourceName(projectId)

  if (MOCK_K8S) {
    logger.info({ projectId, name, namespace: NAMESPACE }, '[mock-k8s] destroyProjectDeployment: would delete Ingress + Service + Deployment')
    return
  }

  const { apps, core, net } = requireK8s()

  const remove = async (kind: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      logger.info({ projectId, name, kind }, 'k8s: deleted resource')
    } catch (err) {
      if (httpStatus(err) === 404) {
        logger.info({ projectId, name, kind }, 'k8s: resource already gone, continuing')
        return
      }
      throw new Error(`Failed to delete ${kind} for ${name}: ${describe(err)}`)
    }
  }

  await remove('Ingress', () => net.deleteNamespacedIngress({ name, namespace: NAMESPACE }))
  await remove('Service', () => core.deleteNamespacedService({ name, namespace: NAMESPACE }))
  await remove('Deployment', () => apps.deleteNamespacedDeployment({ name, namespace: NAMESPACE }))
}

/** Report project runtime status from the Deployment. */
export async function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  const name = projectResourceName(projectId)

  if (MOCK_K8S) {
    logger.info({ projectId, name }, '[mock-k8s] getProjectStatus: returning RUNNING')
    return 'RUNNING'
  }

  const { apps } = requireK8s()
  try {
    const dep = await apps.readNamespacedDeployment({ name, namespace: NAMESPACE })
    const available = dep.status?.availableReplicas ?? 0
    const desired = dep.spec?.replicas
    if (available >= 1) return 'RUNNING'
    if (desired === 0) return 'STOPPED'
    return 'PROVISIONING'
  } catch (err) {
    if (httpStatus(err) === 404) return 'STOPPED'
    throw new Error(`Failed to get status for ${name}: ${describe(err)}`)
  }
}

/** Last 100 log lines of the project's first pod (empty array if none). */
export async function getProjectLogs(projectId: string): Promise<string[]> {
  const name = projectResourceName(projectId)

  if (MOCK_K8S) {
    logger.info({ projectId, name }, '[mock-k8s] getProjectLogs: returning stub logs')
    return [`[mock-k8s] logs for ${name} (USE_MOCK_K8S=true)`]
  }

  const { core } = requireK8s()
  try {
    const pods = await core.listNamespacedPod({ namespace: NAMESPACE, labelSelector: `app=${name}` })
    const podName = pods.items?.[0]?.metadata?.name
    if (!podName) return []

    const raw = await core.readNamespacedPodLog({ name: podName, namespace: NAMESPACE, tailLines: 100 })
    if (!raw) return []
    return raw.split('\n').filter((line) => line.length > 0)
  } catch (err) {
    if (httpStatus(err) === 404) return []
    throw new Error(`Failed to get logs for ${name}: ${describe(err)}`)
  }
}
