# Design: Move project runtime from Docker to Kubernetes

Status: **proposed / awaiting approval**
Owner: environment-service
Related: async container-start fix (already shipped), deferred agent code-execution (K8s Jobs)

## 1. Goal

Run each user project as a **Kubernetes workload** instead of a dockerode-managed
container on the VPS. Keep every existing capability (start/stop/destroy, live
preview, file browser, terminal, git push, workspace up/download) working, and
gain: horizontal scale beyond one host, real resource isolation/quotas, and an
async lifecycle that never blocks an HTTP request (fixing the class of problem
behind the Cloudflare 524 "Invalid response from server.").

Non-goal (this doc): agent code-execution sandbox. It rides on the same cluster
+ RBAC once this lands (ephemeral Jobs), but is tracked separately.

## 0. Locked decisions

1. **Cluster:** self-hosted **k3s, single node, on the existing VPS**. Uses k3s's
   bundled **Traefik** (IngressRoute CRDs available out of the box) and
   **local-path** dynamic PVC provisioner. No new cloud bill. Horizontal scale is
   deferred (add nodes later); we still gain isolation, quotas, and async lifecycle.
2. **env-service placement:** stays in docker-compose on the VPS (alongside the
   app) and reaches the local k3s API server via a scoped **ServiceAccount
   kubeconfig** (`/etc/rancher/k3s/k3s.yaml` restricted to the `synaro-envs`
   namespace). Not run in-cluster — keeps this migration small.
3. **Stop semantics:** **keep the workspace** — stop scales the Deployment to 0,
   the **per-env PVC is retained**, start scales back to 1 with the same files.
   Matches today's Docker behavior (uncommitted work preserved).
4. **App placement:** Next.js app **stays on the VPS**. In prod, a running project
   is reached through its **Traefik subdomain IngressRoute** (every env gets one) —
   so the app never needs to route to a ClusterIP. The host-port `/api/preview/{envId}`
   proxy remains a **Docker/dev-only** path under `DockerRuntime`; under
   `KubernetesRuntime`, preview = the subdomain. This removes the gateway problem.

## 2. What env-service does today (the surface to preserve)

`services/environment-service` is a Fastify service that talks to Docker via
`dockerode`. Everything it exposes is one of two primitives:

**A. Container lifecycle** (`managers/docker.manager.ts`)
- `createEnvironment` — pull image, create+start container, `git clone --depth 1`
  into `/tmp/synaro-workspace/app` (marker files signal clone done), wait, mark
  `RUNNING`. **Blocks up to ~180s.**
- `startEnvironment` / `stopEnvironment` — `container.start()` / `container.stop()`
  (stop **keeps** the container, so the workspace survives a stop→start).
- `destroyEnvironment` — stop + remove + delete DB row.
- `reconcileDeadContainersForProject`, `getContainerStats`.

**B. Everything else is `docker exec` into the running container**
- File browser: `listWorkspaceFilePaths`, `getWorkspaceSelection` (base64 read),
  `writeWorkspaceFile`, `createWorkspaceDirectory`, `deleteWorkspacePath`,
  `renameWorkspacePath`.
- Terminal: `execTerminalCommand` (non-interactive) + `attachContainerInteractiveTerminal`
  (interactive PTY over a WebSocket, `routes/terminal-ws.ts`).
- Git: `getGitWorkspaceChangesSummary`, `gitCommitAndPushWorkspace`.
- Workspace transfer: `uploadWorkspaceTar` (`putArchive`), `exportWorkspaceTarGzip`
  (`getArchive`).

**Networking / preview — two modes today**
- **Prod (Traefik):** container gets Traefik **labels** (`traefik.http.routers.…`)
  and joins the `traefik-net` Docker network; reachable at
  `https://{slug}-{id6}.{SYNARO_DOMAIN}` → container port 3000. Traefik uses the
  **Docker provider**.
- **Dev (port binding):** host port 4000–4999 bound to container :3000; the app's
  `/api/preview/{envId}` proxy fetches `PREVIEW_PROXY_HOST:{port}`.

The `Environment` DB row keys everything off `containerId` (+ `port`, `subdomain`).

## 3. Target architecture on Kubernetes

One **Deployment + Service** per environment in a dedicated namespace
`synaro-envs`, fronted by a **Traefik IngressRoute** (CRD) for the subdomain.

```
Environment "env-<id>"  (namespace: synaro-envs)
├── PersistentVolumeClaim  env-<id>-workspace   (RWO, e.g. 2Gi)  ← survives stop/start
├── Deployment             env-<id>             replicas: 1 (start) / 0 (stop)
│   └── Pod  labels: synaro.env-id=<id>, synaro.project-id=<pid>
│       ├── initContainer  git-clone            (clone into the PVC, once)
│       └── container      app  image: node:20  port 3000  mounts PVC at workspace
├── Service                env-<id>  ClusterIP  :3000
└── IngressRoute           env-<id>  Host(`<slug>-<id6>.<DOMAIN>`) → Service :3000 (TLS)
```

### Mapping table

| Today (Docker)                         | Kubernetes                                             |
|----------------------------------------|-------------------------------------------------------|
| `docker.pull` + `createContainer`      | `Deployment` (+ PVC, Service, IngressRoute); kubelet pulls |
| `container.start()` (from stopped)     | scale Deployment `replicas: 1`                        |
| `container.stop()` (keep workspace)    | scale Deployment `replicas: 0` (**PVC keeps workspace**) |
| `container.remove()` + delete row      | delete Deployment/Service/IngressRoute/PVC + row     |
| git clone in container CMD + markers   | **initContainer** clones into PVC; Pod Ready = done  |
| `container.exec(...)`                  | `@kubernetes/client-node` **Exec** (`connect` API)   |
| interactive PTY exec                   | Exec with `tty:true`, stdin stream ↔ WebSocket       |
| `putArchive` / `getArchive`           | exec `tar` in/out (what `kubectl cp` does)           |
| Traefik container **labels**           | Traefik **IngressRoute CRD** (Kubernetes provider)   |
| host port 4000–4999                    | Service ClusterIP DNS `env-<id>.synaro-envs.svc:3000`|
| `containerId` in DB                    | reuse column to store pod/deployment name (see §6)   |

### Why the initContainer for clone
Moves the slow, failure-prone clone out of the app container and into a K8s-native
readiness signal: **Pod becomes Ready ⇢ status RUNNING.** No marker files, no
180s in-request wait — env-service just **watches** the Deployment.

### Async by construction (the 524 fix, done right)
`create`/`start` apply K8s objects (fast) and return; a **watch/informer** on Pod
readiness flips the `Environment` row to `RUNNING`/`ERROR`. The app's docker route
already returns `202 PROVISIONING` and polls — that contract is unchanged, and now
the backend matches it natively (no floating background promise, survives restarts).

## 4. Code plan

### Phase 0 — Runtime abstraction (no behavior change)
Extract a `RuntimeBackend` interface capturing exactly today's operations
(lifecycle + exec + tar + stats). Move current code into `DockerRuntime`
implementing it. Select via `RUNTIME_BACKEND=docker|kubernetes` (default `docker`).
Keep **local dev on Docker**; prod switches to k8s. This makes the whole migration
reversible and testable side-by-side.

```
services/environment-service/src/runtime/
  types.ts            # RuntimeBackend interface
  docker/…            # existing manager, unchanged behavior
  kubernetes/…        # new
```

### Phase 1 — Cluster prerequisites (k3s on the VPS, manifests in `k8s/`)
- Install k3s (single node). It ships **Traefik** (IngressRoute CRDs) and the
  **local-path** StorageClass — both reused as-is; no cert-manager/StorageClass
  install needed.
- Namespace `synaro-envs` + ResourceQuota + LimitRange.
- ServiceAccount + Role/RoleBinding for env-service (namespace-scoped, least
  privilege): `deployments,services,pods,pods/exec,pods/log,persistentvolumeclaims`
  + `ingressroutes` (traefik.io). Generate a kubeconfig from its token for the
  compose-hosted env-service to mount.
- Wildcard DNS `*.{DOMAIN}` → the VPS; TLS via k3s Traefik's resolver (or the
  existing wildcard cert already used for env subdomains).
- Base runtime image with `git` preinstalled (avoid `apk add git` per env);
  pre-pull it on the node.

### Phase 2 — `KubernetesRuntime` lifecycle
`create/start/stop/destroy` build the objects in §3 with `@kubernetes/client-node`
(`AppsV1Api`, `CoreV1Api`, `CustomObjectsApi` for IngressRoute). Readiness via a
Pod **watch** (informer) → `updateStatus`. Resource requests/limits, non-root,
`readOnlyRootFilesystem` where possible, drop caps.

### Phase 3 — exec-based operations
One `execInPod(namespace, pod, argv, {stdin?, tty?})` helper on top of
`k8s.Exec`. Re-point every file/terminal/git/summary function at it — the shell
scripts are unchanged; only the transport changes. `putArchive`/`getArchive` →
stream `tar` through exec.

### Phase 4 — Interactive terminal WS
`attachContainerInteractiveTerminal` → `Exec` with `tty:true`; pipe pod stdout→WS
and WS→pod stdin; handle resize. `routes/terminal-ws.ts` stays the same shape.

### Phase 5 — Preview / networking
Under `KubernetesRuntime`, a project's public URL **is** its Traefik subdomain
(IngressRoute) — env-service returns that as `publicUrl`, and prod users hit it
directly. The app's `/api/preview/{envId}` host-port proxy is untouched and stays
the **Docker/dev-only** path. No ClusterIP-from-VPS routing needed.

### Phase 6 — Cutover
Sequence the two Traefiks (risk §5.1): let k3s Traefik own :80/:443 with the app
(compose) as an upstream/IngressRoute. Flip `RUNTIME_BACKEND=kubernetes` on the
compose-hosted env-service (kubeconfig mounted); keep `DockerRuntime` for local
dev. Decommission the dockerode prod path after a soak.

## 5. Key risks (post-decision)

**Resolved by §0:** workspace-on-stop (PVC), cluster ownership (k3s/VPS), app
placement (VPS + subdomain), Traefik provider (k3s ships the CRD provider). Remaining:

1. **Two Traefiks during transition.** The VPS already runs a Traefik (compose,
   Docker provider) for the app + current envs; k3s bundles its own Traefik on
   :80/:443. Only one can own the host ports. Plan: let **k3s Traefik own :80/:443**
   and route the app (compose, VPS) as an upstream, or bind k3s Traefik to
   alternate ports behind the existing one. **Must be sequenced carefully at cutover.**
2. **Multi-tenancy / untrusted code.** Pods run arbitrary user projects. Need
   NetworkPolicies (deny east-west, constrain egress), non-root, seccomp, per-env
   ResourceQuota. Single node ⇒ noisy-neighbor and blast-radius matter; consider a
   sandboxed runtime (gVisor/Kata) before opening to untrusted users. Same threat
   model as agent code-exec.
3. **k3s API access from compose.** env-service needs the kubeconfig mounted and
   the API reachable from the container (host network or `host.docker.internal` →
   `127.0.0.1:6443`). Token scoped to `synaro-envs` only.
4. **Single-node capacity.** All env Pods + app + DB share one box. Enforce
   ResourceQuota/LimitRange and an idle-stop reaper (the app already has
   `auto-stop`); revisit multi-node when load grows.
5. **Cold start still exists** (scheduling + image pull + clone). Async UX covers
   it; pre-pulling the base image on the node and a warm image cache reduce it.

## 6. Schema touch (both env-service is the only writer)
`Environment`: keep `containerId` as the generic "workload handle" (store the
Deployment/Pod name), add `namespace String?`. `port` stays null under k8s
(Service DNS replaces it). Minimal migration; app reads are unaffected.

## 7. Rollout order (suggested)
0 → 1 → 2 → 3 → 4 → 5 → 6, shippable at each phase because `DockerRuntime` stays
the default until Phase 6. Earliest user-visible win: Phase 2 gives async,
restart-safe start/stop on the cluster behind a feature flag.
```
