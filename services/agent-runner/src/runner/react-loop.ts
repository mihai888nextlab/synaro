import type OpenAI from 'openai'
import type { FastifyBaseLogger } from 'fastify'
import { kimi, resolveModel } from '../lib/kimi.js'
import { prisma } from '../lib/prisma.js'
import { assembleToolset, runTool, type ToolContext } from '../tools/index.js'
import {
  buildCredentialRequest,
  McpCredentialRequiredError,
  type McpRuntimeAuth,
} from '../tools/mcp-credentials.js'
import { Prisma, type Agent, type AgentRun } from '@prisma/client'

export interface ReActLoopOptions {
  mcpRuntimeAuth?: McpRuntimeAuth
}

export interface ReActStep {
  step: number
  tool: string
  args: Record<string, unknown>
  observation: string
}

const MAX_HISTORY_RUNS = 3
const MAX_HISTORY_BYTES = 4_000

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || 'http://agent-service:3005'
}

async function callKimiWithRetry(
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: OpenAI.ChatCompletionTool[],
): Promise<OpenAI.ChatCompletion> {
  try {
    return await kimi.chat.completions.create({ model, messages, tools, tool_choice: 'auto' })
  } catch {
    await new Promise((r) => setTimeout(r, 2_000))
    return kimi.chat.completions.create({ model, messages, tools, tool_choice: 'auto' })
  }
}

/** Compact summary of the agent's recent completed runs, for cross-run continuity. */
async function buildHistoryContext(agentId: string, currentRunId: string): Promise<string | null> {
  const runs = await prisma.agentRun.findMany({
    where: { agentId, status: 'DONE', id: { not: currentRunId }, output: { not: null } },
    orderBy: { finishedAt: 'desc' },
    take: MAX_HISTORY_RUNS,
    select: { input: true, output: true, finishedAt: true },
  })
  if (runs.length === 0) return null

  let text = 'Context from your recent completed runs (most recent first):\n'
  for (const r of runs) {
    text += `\n- Input: ${r.input ?? '(none)'}\n  Result: ${r.output ?? ''}\n`
    if (Buffer.byteLength(text, 'utf8') > MAX_HISTORY_BYTES) break
  }
  return text.slice(0, MAX_HISTORY_BYTES)
}

async function persistSteps(runId: string, steps: ReActStep[]): Promise<void> {
  try {
    await prisma.agentRun.updateMany({
      where: { id: runId, status: { not: 'CANCELLED' } },
      data: { steps: steps as unknown as Prisma.InputJsonValue },
    })
  } catch {
    // best-effort — never let a persistence hiccup abort the run
  }
}

async function isRunCancelled(runId: string): Promise<boolean> {
  const row = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { status: true },
  })
  return row?.status === 'CANCELLED'
}

async function notifyComplete(
  runId: string,
  status: 'DONE' | 'FAILED' | 'CANCELLED',
  output: string,
  steps: ReActStep[],
): Promise<void> {
  if (await isRunCancelled(runId)) return
  try {
    await fetch(`${agentServiceUrl()}/api/webhook/run-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.AGENT_SERVICE_KEY ?? '',
      },
      body: JSON.stringify({ runId, status, output, steps }),
    })
  } catch {
    // best-effort
  }
}

export async function runReActLoop(
  run: AgentRun,
  agent: Agent,
  log: FastifyBaseLogger,
  options?: ReActLoopOptions,
): Promise<void> {
  let toolset: Awaited<ReturnType<typeof assembleToolset>> | undefined

  try {
    if (await isRunCancelled(run.id)) return

    await prisma.agentRun.updateMany({
      where: { id: run.id, status: { not: 'CANCELLED' } },
      data: { status: 'RUNNING', startedAt: new Date(), credentialRequest: Prisma.DbNull },
    })

    if (await isRunCancelled(run.id)) return

    try {
      toolset = await assembleToolset(agent, log, options?.mcpRuntimeAuth)
    } catch (err) {
      if (err instanceof McpCredentialRequiredError) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'NEEDS_INPUT',
            credentialRequest: buildCredentialRequest(err.serverName, err.serverUrl) as unknown as Prisma.InputJsonValue,
          },
        })
        return
      }
      throw err
    }

    if (toolset.tools.length === 0) {
      await notifyComplete(run.id, 'FAILED', 'Agent has no tools enabled', [])
      return
    }

    const hasNonMcpTools = toolset.tools.some((t) => {
      const name = t.definition.function.name
      return name !== 'finish' && !name.startsWith('mcp__')
    })

    if (toolset.wantsMcp && toolset.mcpToolCount === 0 && !hasNonMcpTools) {
      const detail =
        toolset.mcpErrors.length > 0
          ? toolset.mcpErrors.join(' ')
          : 'Check server URLs and auth headers in the agent MCP config.'
      await notifyComplete(
        run.id,
        'FAILED',
        `Could not connect to any MCP server. ${detail}`,
        [],
      )
      return
    }

    const ctx: ToolContext = { userId: agent.userId, agentId: agent.id, runId: run.id, depth: 0 }
    const model = resolveModel(agent.model)

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: agent.systemPrompt },
    ]
    const history = await buildHistoryContext(agent.id, run.id)
    if (history) messages.push({ role: 'system', content: history })
    messages.push({ role: 'user', content: run.input ?? 'Please complete your task.' })

    const definitions = toolset.tools.map((t) => t.definition)
    const steps: ReActStep[] = []

    for (let step = 0; step < agent.maxSteps; step++) {
      if (await isRunCancelled(run.id)) return

      let response: OpenAI.ChatCompletion
      try {
        response = await callKimiWithRetry(model, messages, definitions)
      } catch (err) {
        await notifyComplete(run.id, 'FAILED', `LLM error: ${String(err)}`, steps)
        return
      }

      const assistantMsg = response.choices[0]?.message
      if (!assistantMsg) {
        await notifyComplete(run.id, 'FAILED', 'Empty response from LLM', steps)
        return
      }

      const toolCalls = assistantMsg.tool_calls ?? []
      if (toolCalls.length === 0) {
        await notifyComplete(run.id, 'DONE', assistantMsg.content ?? '', steps)
        return
      }

      messages.push(assistantMsg)

      for (const call of toolCalls) {
        if (await isRunCancelled(run.id)) return

        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments) as Record<string, unknown>
        } catch {
          args = {}
        }

        const observation = await runTool(toolset, call.function.name, args, ctx)
        steps.push({ step, tool: call.function.name, args, observation })
        await persistSteps(run.id, steps)

        messages.push({ role: 'tool', tool_call_id: call.id, content: observation })

        if (call.function.name === 'finish') {
          await notifyComplete(run.id, 'DONE', String(args.answer ?? observation), steps)
          return
        }
      }
    }

    await notifyComplete(run.id, 'FAILED', 'Max steps reached without finishing', steps)
  } catch (err) {
    log.error({ err, runId: run.id }, 'ReAct loop failed')
    const message = err instanceof Error ? err.message : String(err)
    await notifyComplete(run.id, 'FAILED', `Runner error: ${message}`, [])
  } finally {
    if (toolset) await toolset.close()
  }
}
