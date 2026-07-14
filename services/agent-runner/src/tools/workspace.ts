import { promises as fs } from 'fs'
import path from 'path'
import type { AgentTool, ToolContext } from './types.js'

/**
 * A persistent, per-agent file workspace. Files written in one run are readable
 * in later runs, letting agents accumulate artifacts. Everything is confined to
 * `${WORKSPACES_PATH}/${agentId}` with a path-traversal guard and size caps.
 */

const MAX_FILE_BYTES = 256 * 1024 // 256KB per file
const MAX_READ_BYTES = 100 * 1024 // truncate reads past 100KB

function workspacesRoot(): string {
  return process.env.WORKSPACES_PATH?.trim() || '/workspaces'
}

/** Resolve `relPath` inside the agent's workspace, rejecting traversal escapes. */
async function resolveInWorkspace(agentId: string, relPath: string): Promise<string> {
  const base = path.resolve(workspacesRoot(), agentId)
  const target = path.resolve(base, relPath)
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('path escapes the agent workspace')
  }
  return target
}

async function ensureBase(agentId: string): Promise<string> {
  const base = path.resolve(workspacesRoot(), agentId)
  await fs.mkdir(base, { recursive: true })
  return base
}

export const workspaceTools: AgentTool[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'list_files',
        description:
          'List files in your persistent workspace. Optionally pass a subdirectory. Files persist across runs.',
        parameters: {
          type: 'object',
          properties: { dir: { type: 'string', description: 'Optional subdirectory (default: root)' } },
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      await ensureBase(ctx.agentId)
      try {
        const dir = await resolveInWorkspace(ctx.agentId, String(args.dir ?? '.'))
        const entries = await fs.readdir(dir, { withFileTypes: true })
        if (entries.length === 0) return '(empty)'
        return entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort()
          .join('\n')
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file from your persistent workspace.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Path relative to your workspace' } },
          required: ['path'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      await ensureBase(ctx.agentId)
      try {
        const target = await resolveInWorkspace(ctx.agentId, String(args.path ?? ''))
        const buf = await fs.readFile(target)
        if (buf.byteLength > MAX_READ_BYTES) {
          return buf.toString('utf8', 0, MAX_READ_BYTES) + '\n[truncated]'
        }
        return buf.toString('utf8')
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write (create or overwrite) a file in your persistent workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to your workspace' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      await ensureBase(ctx.agentId)
      try {
        const content = String(args.content ?? '')
        if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
          return `Error: file exceeds ${MAX_FILE_BYTES} byte limit`
        }
        const target = await resolveInWorkspace(ctx.agentId, String(args.path ?? ''))
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, content, 'utf8')
        return `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${args.path}.`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'delete_file',
        description: 'Delete a file from your persistent workspace.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Path relative to your workspace' } },
          required: ['path'],
        },
      },
    },
    async execute(args, ctx: ToolContext) {
      await ensureBase(ctx.agentId)
      try {
        const target = await resolveInWorkspace(ctx.agentId, String(args.path ?? ''))
        await fs.rm(target, { recursive: true, force: true })
        return `Deleted ${args.path}.`
      } catch (err) {
        return `Error: ${String(err)}`
      }
    },
  },
]
