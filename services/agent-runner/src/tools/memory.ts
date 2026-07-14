import { prisma } from '../lib/prisma.js'
import type { AgentTool, ToolContext } from './types.js'

/**
 * Durable per-agent key/value memory. Unlike the workspace (files), this is
 * structured recall the agent manages explicitly across runs. Backed by the
 * AgentMemory table. Full vector RAG is intentionally out of scope.
 */

const MAX_CONTENT_BYTES = 16 * 1024

export const memoryTools: AgentTool[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'remember',
        description:
          'Save a fact to your durable memory under a key, so future runs can recall it. Overwrites an existing key.',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'A short identifier for this memory' },
            content: { type: 'string', description: 'The content to remember' },
          },
          required: ['key', 'content'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const key = String(args.key ?? '').trim()
      const content = String(args.content ?? '')
      if (!key) return 'Error: key is required.'
      if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES)
        return `Error: content exceeds ${MAX_CONTENT_BYTES} byte limit.`
      try {
        await prisma.agentMemory.upsert({
          where: { agentId_key: { agentId: ctx.agentId, key } },
          create: { agentId: ctx.agentId, key, content },
          update: { content },
        })
        return `Remembered "${key}".`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'recall',
        description:
          'Recall from your durable memory. Pass a key to read one entry, or omit it to list all remembered keys.',
        parameters: {
          type: 'object',
          properties: { key: { type: 'string', description: 'Optional key to recall' } },
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      const key = args.key ? String(args.key).trim() : ''
      try {
        if (key) {
          const row = await prisma.agentMemory.findUnique({
            where: { agentId_key: { agentId: ctx.agentId, key } },
          })
          return row ? row.content : `No memory found for "${key}".`
        }
        const rows = await prisma.agentMemory.findMany({
          where: { agentId: ctx.agentId },
          orderBy: { updatedAt: 'desc' },
          select: { key: true },
        })
        if (rows.length === 0) return 'No memories stored yet.'
        return `Remembered keys:\n${rows.map((r) => `- ${r.key}`).join('\n')}`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
]
