# Agentic tool-loop for code generation

## Context — why change

Today's generation is a **fixed pipeline of blind, stateless one-shot calls**: `classifyTaskIntent →
detectProjectContext → scan → triageTask → (runEditPass | planFiles + generateFilesInParallel) →
apply → runHealthCheck`. Each stage is a separate model call with no shared memory; the code-gen call
gets files stuffed into a prompt and must emit the **entire** change as one JSON blob, with no ability
to read another file, check whether its `search` matched, or see an error.

Nearly every bug we've hit is a direct consequence of that shape: empty-assistant 400s, snippet
mismatches → full rewrite, truncation/continuation loops, stalled streams, JSON parse failures,
timeouts. We keep bolting on error-recovery to make a one-shot pipeline imitate an agent.

**The fix is architectural: run the model as an agent in a tool-use loop** (observe → act → observe
result → adapt), the way Claude Code works. Kimi K2 is an agentic, tool-calling model and the Moonshot
API is OpenAI-compatible with function calling — we're currently using an agentic model in the one
shape it's worst at. This migrates code generation to a real tool loop, shipped **behind a flag**
beside the current pipeline so we can compare and roll back.

## Target architecture

A single agent session per task:

1. **System prompt**: role + rules + the existing project grounding (`detectProjectContext` /
   `AGENTS.md`), plus explicit stop criteria ("call `finish` when the change is complete and, for a
   server app, the build/typecheck passes").
2. **Tools** (function schemas passed as `tools`, `tool_choice: 'auto'`), each backed by code we
   already have:
   | tool | args | backed by |
   |---|---|---|
   | `list_files` | `{ dir? }` | `listContainerFiles(envId)` (filter by prefix) |
   | `read_file` | `{ path, start?, end? }` | `readContainerFile(envId, path)` (range-slice, cap size) |
   | `edit_file` | `{ path, search, replace }` | `applySearchReplace` (extract from `edit-pass.ts`) + `writeContainerFiles` |
   | `write_file` | `{ path, content }` | `writeContainerFiles(envId, [...])` |
   | `run_command` | `{ command }` | `remoteExec(envId, command, timeoutMs)` (bounded output) |
   | `finish` | `{ summary }` | ends the loop; `summary` becomes `Task.result.summary` |
3. **The loop** (`engine/agent-loop.ts`):
   ```
   messages = [system, user(task + grounding)]
   for step in 0..MAX_STEPS:
     resp = kimi.chat.completions.create({ model: GENERATE, messages, tools, stream: true })
     append resp.assistant message (content + tool_calls) to messages
     if no tool_calls: nudge "use a tool or call finish" (bounded) or break
     for each tool_call: execute → append { role: 'tool', tool_call_id, content: result }
     if finish called → break
     if Date.now() > deadline → break (return what's on disk)
   ```
   Tools mutate the container **directly** (no separate "apply" phase — the agent's edits are the
   changes). The git/commit tail and DONE bookkeeping stay in the orchestrator.
4. **Streaming = the live view.** Reuse the `streamChat` idle-watchdog work: stream the assistant's
   text and surface each tool call as an activity line into `Task.streamContent` / `progress`
   ("Reading src/App.tsx", "Editing …", "Running npm run build") — that IS "what the AI is thinking".
5. **Budgets:** `MAX_STEPS` (e.g. 24), wall-clock (`ORCHESTRATION.MAX_TASK_MS`), per-tool timeouts,
   and a context guard that truncates/reranks old `read_file`/`run_command` outputs when messages grow.

## Key implementation details (where the sharp edges are)

- **Tool-call messages are the empty-content case done right.** An assistant message with `tool_calls`
  legitimately has `content: null` — that's valid to the API (unlike our earlier empty-assistant 400).
  Send `tool_calls` through and reply with one `role: 'tool'` message per `tool_call_id`.
- **Streaming tool calls arrive fragmented.** `delta.tool_calls[].function.arguments` is streamed in
  pieces and must be concatenated by `index` before `JSON.parse`. Simplest first cut: **stream only
  the assistant's text for the UI, but read tool calls from a non-streaming call per step** (one
  request per step either way). Add streamed tool-call assembly later if we want it.
- **Bounded tool outputs.** `read_file` caps bytes and supports `start/end` line ranges; `run_command`
  truncates to the last ~8 KB (env-service already caps at 96 KB) and always returns the exit code.
  This keeps the message history from exploding.
- **`edit_file` reuses the tolerant matcher + one self-correct.** Extract `applySearchReplace` from
  `edit-pass.ts` into `engine/apply-edit.ts`; on a miss, the tool result says "search not found — here
  are the N lines around the closest region" so the model fixes it *itself next step* (no orchestrator
  fallback needed — the loop is the recovery).
- **Self-verification.** Encourage the agent to `run_command` the build/typecheck and fix failures
  before `finish`. The final `runHealthCheck` stays as a backstop but should rarely find anything.
- **run_command safety.** It's the user's own 512 MB container; keep the existing per-command timeout,
  cap output, and (optionally) refuse obviously destructive patterns (`rm -rf /`, etc.).

## Where it plugs in

- New: `services/ai-orchestration-service/src/engine/agent-loop.ts` (the loop),
  `engine/agent-tools.ts` (tool schemas + executors mapping to `environment-client.ts`),
  `engine/apply-edit.ts` (extracted `applySearchReplace`).
- `engine/orchestrator.ts`: after context + env lookup, branch on a flag —
  `ORCHESTRATOR_MODE=agent` (env var, or per-task field) → `runAgentLoop(...)`; else the current
  pipeline unchanged. Keep the shared tail: git push, `updateTask` DONE/FAILED, token/step accounting.
- `lib/kimi.ts`: add a `streamChatWithTools` (or extend `streamChat`) that accepts `tools` and returns
  `{ content, toolCalls, usage, finishReason }`.
- Reused as-is: `remoteExec`, `readContainerFile`, `writeContainerFiles`, `listContainerFiles`,
  `getGitWorkspaceChangesSummary`, `gitPushWorkspace`, `detectProjectContext`, `runHealthCheck`.

## Rollout phases (each shippable, flag-gated)

1. **Loop + tools behind `ORCHESTRATOR_MODE=agent`.** `read_file`, `list_files`, `edit_file`,
   `write_file`, `finish`; non-streaming per-step; text streamed to `streamContent`. Pipeline stays
   default. Compare on real edits.
2. **`run_command` + self-verify.** Agent runs build/typecheck and fixes its own errors; health check
   becomes a backstop.
3. **Streamed tool-call activity lines** in the UI (assemble fragmented `tool_calls`).
4. **Make agent the default**; retire `edit-pass.ts`, `file-generator.ts`, `file-planner.ts`,
   `worker.ts`, and the simple/complex fork once the agent path is proven. Triage is kept only as an
   optional seed hint (or dropped).

## Trade-offs (honest)

- **More round-trips per task** → higher latency and token cost per change than a lucky one-shot. Bound
  it with `MAX_STEPS` and small tool outputs; streaming keeps the UX responsive so latency is *visible
  progress*, not a hang.
- **Leans on tool-calling reliability** — but that's exactly Kimi K2's strength, and it's far more
  robust than one-shot JSON. The pipeline stays as a fallback/flag until the agent proves out.

## Verification

- Deploy env-service unchanged; ai-orchestration-service is src-mounted → `restart`.
- With `ORCHESTRATOR_MODE=agent`: run a small edit on an existing Next.js project → the agent should
  `read_file` then `edit_file` and finish quickly; watch tool calls stream into the chat.
- A change that previously fell to a full rewrite should now be a couple of `edit_file` steps.
- Break the build on purpose in the prompt → agent should `run_command` the build, see the error, fix
  it, and finish (phase 2).
- Flip the flag off → identical behavior to today (pipeline), proving the branch is isolated.
