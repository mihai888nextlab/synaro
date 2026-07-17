# Changelog

## 0.2.0

### DX

- Normalize **`agentId`** / **`runId`** on every agent and run DTO (from wire `id` when needed)
- Async iterators: `tasks.watch(taskId)`, `runs.watch(runId)`; `runs.wait` uses `watch` internally
- CLI bin: `synaro` (`npx synaro me`, `projects deploy`, `agents run`, …)
- Hide API key on `SynaroHttpClient` (private `#apiKey`; no longer readable via `client.http.apiKey`)
- Publish metadata: `publishConfig.access`, repository/homepage/bugs, LICENSE, dual-package `exports` types

## 0.1.0

### Phase 1 — wrap `/api/v1`

- Typed client: `me`, `status`, `projects`, `tasks`, `agents`, `runs`
- Long-running helpers: `projects.deploy` / `ensureRunning`, `tasks.run`, `agents.run`, `runs.wait`
- Errors: `AuthError`, `RateLimitError`, `NeedsInputError`, `SynaroError`
- OpenAPI: `openapi/v1.yaml`

### Phase 2 — public API parity (server + SDK)

- `runs.cancel`, `runs.submitCredentials`, `runs.active`, `runs.recent`
- `agents.memory(agentId).list|upsert|delete|clear`
- Agent run list `limit` / `offset` forwarded by `/api/v1/agents/:id/runs`
