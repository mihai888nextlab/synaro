import type OpenAI from 'openai'
import { kimi, MODEL } from '../lib/kimi.js'
import { prisma } from '../lib/prisma.js'
import { TOOL_DEFINITIONS, executeTool } from '../tools/index.js'
import type { Agent, AgentRun } from '@prisma/client'

export interface ReActStep {
  step: number
  tool: string
  args: Record<string, unknown>
  observation: string
}

function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || 'http://agent-service:3005'
}

async function callKimiWithRetry(
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: OpenAI.ChatCompletionTool[],
): Promise<OpenAI.ChatCompletion> {
  try {
    return await kimi.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    })
  } catch {
    // Retry once after 2s
    await new Promise((r) => setTimeout(r, 2_000))
    return kimi.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    })
  }
}

async function persistSteps(runId: string, steps: ReActStep[]): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { steps: steps as object[], status: 'RUNNING' },
  })
}

async function notifyComplete(
  runId: string,
  status: 'DONE' | 'FAILED',
  output: string,
  steps: ReActStep[],
): Promise<void> {
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

export async function runReActLoop(run: AgentRun, agent: Agent): Promise<void> {
  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: 'RUNNING', startedAt: new Date() },
  })

  const enabledTools = TOOL_DEFINITIONS.filter((t) => agent.tools.includes(t.function.name))
  if (enabledTools.length === 0) {
    await notifyComplete(run.id, 'FAILED', 'Agent has no tools enabled', [])
    return
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: run.input ?? 'Please complete your task.' },
  ]

  const steps: ReActStep[] = []

  for (let step = 0; step < agent.maxSteps; step++) {
    let response: OpenAI.ChatCompletion
    try {
      response = await callKimiWithRetry(messages, enabledTools)
    } catch (err) {
      if (steps.length > 0) await persistSteps(run.id, steps)
      await notifyComplete(run.id, 'FAILED', `LLM error: ${String(err)}`, steps)
      return
    }

    const assistantMsg = response.choices[0]?.message
    if (!assistantMsg) {
      if (steps.length > 0) await persistSteps(run.id, steps)
      await notifyComplete(run.id, 'FAILED', 'Empty response from LLM', steps)
      return
    }

    const toolCalls = assistantMsg.tool_calls ?? []

    if (toolCalls.length === 0) {
      // No tool call — treat the content as a final answer
      const answer = assistantMsg.content ?? ''
      await notifyComplete(run.id, 'DONE', answer, steps)
      return
    }

    // Append the assistant's message before processing tool calls
    messages.push(assistantMsg)

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments) as Record<string, unknown>
      } catch {
        args = {}
      }

      const observation = await executeTool(call.function.name, args)

      steps.push({ step, tool: call.function.name, args, observation })
      await persistSteps(run.id, steps)

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: observation,
      })

      if (call.function.name === 'finish') {
        const answer = String(args.answer ?? observation)
        await notifyComplete(run.id, 'DONE', answer, steps)
        return
      }
    }
  }

  if (steps.length > 0) await persistSteps(run.id, steps)
  await notifyComplete(run.id, 'FAILED', 'Max steps reached without finishing', steps)
}
