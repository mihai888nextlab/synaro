# @synaro/sdk

Official TypeScript/JavaScript client for the Synaro **public API** (`/api/v1`).

Authenticate with a dashboard-minted API key (`sk_live_…`). Key CRUD stays in the Synaro UI under **Settings → API keys** — it is not part of this SDK.

## Install

```bash
npm install @synaro/sdk
```

## Quickstart

```ts
import { Synaro } from "@synaro/sdk";

const synaro = new Synaro({
  apiKey: process.env.SYNARO_API_KEY!,
  // baseUrl: "http://localhost:3000", // local
});

const me = await synaro.me();
console.log(me.email);

const project = await synaro.projects.create({ name: "demo" });
await synaro.projects.deploy(project.projectId);

const task = await synaro.tasks.run(project.projectId, "Add a health check route");
console.log(task.summary);

const agent = await synaro.agents.create({
  name: "Nightly summary",
  systemPrompt: "Summarize repo changes",
  toolMode: "auto",
});
const run = await synaro.agents.run(agent.agentId, "Summarize yesterday");
console.log(run.runId, run.output);

for await (const update of synaro.runs.watch(run.runId)) {
  console.log(update.status);
}
```

## Resources

| Resource | Highlights |
|----------|------------|
| `synaro.me()` / `synaro.status()` | Verify key; platform + project health |
| `synaro.projects` | `list`, `create`, `get`, `delete`, `start`, `stop`, `deploy`, `logs`, `ensureRunning`, `withPreview` |
| `synaro.tasks` | `create`, `list`, `get`, `run`, **`watch`** (async iterator) |
| `synaro.agents` | CRUD, `trigger`, `listRuns`, `run`, `memory(agentId).*` — responses always include **`agentId`** |
| `synaro.runs` | `get`, `wait`, **`watch`**, `cancel`, `submitCredentials`, `active`, `recent` — responses always include **`runId`** |

### Conventions

- **TypeScript API** uses **camelCase**.
- Agent/run DTOs always expose canonical **`agentId`** / **`runId`** (mapped from wire `id` when needed).
- **Wire format** for projects/tasks/deploy is **snake_case**; agent **writes** use **camelCase** (agent-service). Responses are normalized to camelCase for you.
- Non-idempotent: `create`, `trigger`, `deploy`, `tasks.create`.
- Rate limits: default ~120 req/min per key. The client retries **once** on `429` unless `retryOnRateLimit: false`.

### Watch iterators

```ts
for await (const snap of synaro.tasks.watch(taskId, { pollIntervalMs: 2000 })) {
  console.log(snap.status, snap.progress);
}

for await (const snap of synaro.runs.watch(runId)) {
  console.log(snap.status);
  if (snap.status === "NEEDS_INPUT") break;
}
```

### Errors

```ts
import { AuthError, RateLimitError, NeedsInputError, SynaroError } from "@synaro/sdk";

try {
  await synaro.agents.run("agent_…", "hello");
} catch (err) {
  if (err instanceof NeedsInputError) {
    await synaro.runs.submitCredentials(err.runId, {
      github: { Authorization: "Bearer …" },
    });
  } else if (err instanceof RateLimitError) {
    console.log("retry after", err.retryAfterSec);
  } else if (err instanceof SynaroError) {
    console.log(err.status, err.body);
  }
}
```

## CLI

After install (or from this package):

```bash
export SYNARO_API_KEY=sk_live_…
# optional: export SYNARO_BASE_URL=http://localhost:3000

npx synaro me
npx synaro projects list
npx synaro projects deploy <projectId>
npx synaro agents run <agentId> "Summarize yesterday"
npx synaro tasks run <projectId> Add a health check
npx synaro runs wait <runId>
```

Local monorepo:

```bash
cd packages/sdk && npm run build && node dist/cli.js me
```

## OpenAPI

See [`openapi/v1.yaml`](./openapi/v1.yaml) for the HTTP contract (useful for codegen / Python clients later).

## Docs

- In-app SDK guide: [/documentation/public-api-sdk](https://synaro.tech/documentation/public-api-sdk)
- Public API overview: [/documentation/public-api](https://synaro.tech/documentation/public-api)
- Agents HTTP: [/documentation/public-api-agents](https://synaro.tech/documentation/public-api-agents)

## Development

```bash
cd packages/sdk
npm install
npm test
npm run build
```
