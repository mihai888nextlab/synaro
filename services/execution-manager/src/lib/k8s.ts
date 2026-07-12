import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  NetworkingV1Api,
} from '@kubernetes/client-node'

/**
 * Kubernetes client singleton (mirrors the src/lib/prisma.ts pattern).
 *
 * Config source, in priority order:
 *   - USE_MOCK_K8S=true  → do not load any config; API clients stay undefined
 *     and k8s.manager runs in mock mode (logs intended actions only).
 *   - in-cluster (KUBERNETES_SERVICE_HOST set) → loadFromCluster() + the pod's
 *     ServiceAccount token.
 *   - otherwise → loadFromDefault() ($KUBECONFIG or ~/.kube/config; for K3s
 *     point that at /etc/rancher/k3s/k3s.yaml).
 */
export const MOCK_K8S = process.env.USE_MOCK_K8S === 'true'

const kc = new KubeConfig()

if (!MOCK_K8S) {
  if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster()
  } else {
    kc.loadFromDefault()
  }
}

export const k8sConfig = kc

export const k8sAppsApi = MOCK_K8S ? undefined : kc.makeApiClient(AppsV1Api)
export const k8sCoreApi = MOCK_K8S ? undefined : kc.makeApiClient(CoreV1Api)
export const k8sNetworkApi = MOCK_K8S ? undefined : kc.makeApiClient(NetworkingV1Api)

/** Typed non-null accessor for the API clients (never called in mock mode). */
export function requireK8s(): {
  apps: AppsV1Api
  core: CoreV1Api
  net: NetworkingV1Api
} {
  if (!k8sAppsApi || !k8sCoreApi || !k8sNetworkApi) {
    throw new Error('Kubernetes client is not initialized (USE_MOCK_K8S=true?)')
  }
  return { apps: k8sAppsApi, core: k8sCoreApi, net: k8sNetworkApi }
}
