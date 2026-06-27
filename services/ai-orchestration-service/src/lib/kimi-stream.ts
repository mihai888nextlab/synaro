import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import { kimi, MODELS } from './kimi.js'
import { prisma } from './prisma.js'

const STREAM_FLUSH_MS = 250

/** Hide partial JSON from the chat stream while the model is emitting structured output. */
export function streamPreviewForChat(raw: string): string {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('{')) return ''
  return raw
}

function createStreamThrottler(taskId: string, preview: (raw: string) => string) {
  let lastFlush = 0
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async (text: string) => {
    const previewText = preview(text)
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: { streamContent: previewText || null },
      })
    } catch {
      // streamContent column missing or DB unavailable — streaming UI degrades gracefully
    }
    lastFlush = Date.now()
    pending = null
  }

  return {
    push(fullText: string) {
      pending = fullText
      const now = Date.now()
      if (now - lastFlush >= STREAM_FLUSH_MS) {
        void flush(fullText)
        return
      }
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          if (pending != null) void flush(pending)
        }, STREAM_FLUSH_MS - (now - lastFlush))
      }
    },
    async finish(fullText: string) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      await flush(fullText)
    },
    async clear() {
      if (timer) clearTimeout(timer)
      try {
        await prisma.task.update({
          where: { id: taskId },
          data: { streamContent: null },
        })
      } catch {
        // ignore — column may be missing until migration is applied
      }
    },
  }
}

export async function streamKimiChatCompletion(opts: {
  taskId: string
  messages: ChatCompletionMessageParam[]
  model?: string
  maxTokens?: number
  /** When true, write the raw model text to streamContent (for markdown Q&A). */
  plainTextStream?: boolean
}): Promise<{
  content: string
  inputTokens: number
  outputTokens: number
  finishReason: string | null
}> {
  const preview = opts.plainTextStream
    ? (raw: string) => raw
    : streamPreviewForChat
  const throttler = createStreamThrottler(opts.taskId, preview)
  let full = ''

  const stream = await kimi.chat.completions.create({
    model: opts.model ?? MODELS.GENERATE,
    max_tokens: opts.maxTokens ?? 1200,
    messages: opts.messages,
    stream: true,
  })

  let inputTokens = 0
  let outputTokens = 0
  let finishReason: string | null = null

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
    const delta = choice?.delta?.content ?? ''
    if (delta) {
      full += delta
      throttler.push(full)
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? inputTokens
      outputTokens = chunk.usage.completion_tokens ?? outputTokens
    }
  }

  await throttler.finish(full)
  return { content: full.trim(), inputTokens, outputTokens, finishReason }
}
