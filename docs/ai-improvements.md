# AI improvement backlog

Ideas for improving Synaro's code-gen agent (the `ORCHESTRATOR_MODE=agent` tool-loop). Tagged
**[priority · effort]** — priority High/Med/Low, effort S/M/L. Not exhaustive-ordered; the suggested
near-term sequence is at the bottom.

---

## Already shipped (this iteration)
- Agentic tool-loop (`agent-loop.ts` + `agent-tools.ts`): read/list/edit/write/run_command/finish.
- Streaming output → live "what the AI is doing" in the chat.
- Tolerant search/replace matcher (`apply-edit.ts`) + one corrective round-trip in the edit pass.
- Stall watchdog on streams; per-step timeout that keeps partial work instead of failing the task.
- Context pruning (trim old tool outputs).
- Self-verify backstop (forced build/typecheck on substantial changes).
- Greenfield scaffolding (language-aware) with a larger step budget.
- Working cancellation (Stop mid-loop); seeded file list; batched tool calls.

---

## 1. Speed / latency
- **Split-model routing** — cheap/fast model for navigation (read/list/decide), `kimi-k2.6` only for writing code. Biggest remaining win; needs A/B testing of the fast model's tool-calling reliability. **[High · M]**
- **Prompt / context caching** — reuse the system prompt + seeded file list across steps (Moonshot context caching if available) instead of re-sending every round-trip. Large token + latency saver. **[High · M]**
- **`multi_edit` tool** — apply several edits to one file in a single tool call (fewer round-trips). **[Med · S]**
- **Warm dev server for verify** — verify by hitting the already-running app (HTTP 200) instead of a cold `tsc`/build where possible. **[Med · M]**
- **Incremental typecheck** — `tsc` with project references / only changed files rather than the whole project. **[Med · M]**
- **Force first-step tool use** (`tool_choice`) — skip an opening prose-only step. **[Low · S]**

## 2. Tools (new / better)
- **`search` (ripgrep) tool** — find code by content, not just path listing. Huge for large repos; cuts read-flailing. **[High · S]**
- **`rename` / `delete` / `mkdir`** — reuse existing env-service workspace endpoints. **[Med · S]**
- **`git_status` / `git_diff`** — let the agent see exactly what it changed before finishing. **[Low · S]**
- **`apply_patch` (unified diff)** — alternative to search/replace for multi-hunk edits. **[Low · M]**
- **`read_many`** — batch reads (or keep relying on parallel tool calls). **[Low · S]**

## 3. Reliability / correctness
- **Fuzzy-locate on edit miss** — when `search` doesn't match, return the nearest region + line numbers so the model fixes it in one step instead of re-reading blindly. **[High · S]**
- **Loop / duplicate-call guard** — detect the agent re-reading the same file or repeating a failing action and nudge it. **[Med · S]**
- **Transient-error retry** — retry a single failed step once (network/5xx) before stopping. **[Med · S]**
- **Path-safety audit** — confirm tools can't touch files outside the workspace (env-service sanitizes; verify end-to-end). **[Med · S]**

## 4. Verification & quality gates
- **Runtime smoke test** — after changes, start/hit the dev server for a 200 as a cheap "it runs" check. **[Med · M]**
- **Lint gate** — run eslint for style consistency (the app's AGENTS.md cares about design tokens). **[Low · M]**
- **Design/visual check for UI** — screenshot + heuristic (or model) review of rendered output. Hard; future. **[Low · L]**

## 5. Context management
- **Edit-aware pruning** — keep contents of files being actively edited full-size; prune only stale reads (current keep-last-8 is blind). **[Med · M]**
- **Summarize long build errors** instead of raw truncation, so the model sees the actionable part. **[Low · M]**
- **Token-based (not char-based) budgeting** for reads and pruning. **[Low · S]**

## 6. Model strategy
- **Auto-select model by task size** — tiny edit → cheaper model; big build → `k2.6`. **[Med · M]**
- **Faster/turbo Moonshot tier** — one-line `MODELS.GENERATE` swap if the account has a quicker capable variant; A/B it. **[Med · S]**
- **Temperature/params tuning** for code generation. **[Low · S]**

## 7. UX / visibility
- **Streamed tool-call args (Phase 3)** — assemble fragmented `tool_calls` so each edit forms live in the chat. **[Med · M]**
- **Per-step timing in the activity log** — show where the time goes. **[Low · S]**
- **Agent-maintained plan/todo** surfaced in the UI. **[Low · M]**
- **Inline diff preview per edit** (changes already carry `previousContent`). **[Low · M]**

## 8. Greenfield / scaffolding
- **Starter templates** — clone a vetted starter and edit it, instead of writing every file by hand. Big greenfield speedup + reliability. **[High · M]**
- **Better "is this even a project?" detection** — script/snippet vs full app (partly done via language-aware scaffold). **[Low · S]**

## 9. Runtime / language support
- **Fix non-3000 ports** — auto-configure `PORT`/host for Vite (5173), Angular (4200), etc., or map preview to the real port. Removes a silent "preview blank" class of bugs. **[Med · M]**
- **More runtimes** — Go/Ruby/PHP/etc. via per-stack base images + detection in `run.ts`/`health-check.ts`/deploy manager. Ties to the k3s migration. **[Low · L]**
- **Better Python** — venv / `uv` / poetry support. **[Low · M]**

## 10. Safety / guardrails
- **Destructive-command guard** — refuse obviously dangerous `run_command`s (`rm -rf /`, etc.). **[Med · S]**
- **Per-task cost/token cap** — hard ceiling so a runaway task can't burn the budget. **[Med · S]**
- **Secret hygiene** — avoid echoing env secrets into logs / `streamContent`. **[Low · M]**

## 11. Memory / cross-task learning
- **Agent-maintained AGENTS.md** — persist conventions/decisions the agent should follow next time. **[Low · M]**
- **Project notes** the agent reads/writes across tasks. **[Low · M]**

## 12. Observability & evaluation
- **Eval harness** — a fixed set of benchmark tasks (edits + builds) to measure quality + latency on every change. Highest-leverage for iterating confidently. **[High · M]**
- **Per-tool metrics** — edit-miss rate, verify-fail rate, avg steps/tokens/duration per task. **[Med · M]**
- **Structured per-task telemetry** — extend `meta` (tokens, steps, duration, model) for dashboards. **[Med · S]**

## 13. Tech debt / cleanup (Phase 4)
- **Make agent the default** and retire `edit-pass.ts` / `worker.ts` / `file-planner.ts` / `file-generator.ts` / the simple-complex fork once proven. **[High · M]**
- **Delete remaining dead code** — `planner.ts`, `integrator.ts`, `runWorkersInParallel`. **[Med · S]**
- **Tests** for `agent-loop`, `agent-tools`, `apply-edit`. **[Med · M]**
- **Boot-time reconciler** — mark stale in-progress tasks FAILED on service startup (orphaned tasks after a crash/restart). **[Med · S]**

---

## Suggested near-term sequence
1. `search` (ripgrep) tool + fuzzy-locate on edit miss — cheap, big reliability/speed wins. **[§2, §3]**
2. Prompt/context caching + `multi_edit` — the two biggest latency levers that don't risk quality. **[§1]**
3. Eval harness — so every later change (esp. the split-model experiment) is measured, not guessed. **[§12]**
4. Split-model routing (flag-gated, measured against the eval harness). **[§1, §6]**
5. Phase 4 cleanup once the above prove out. **[§13]**
