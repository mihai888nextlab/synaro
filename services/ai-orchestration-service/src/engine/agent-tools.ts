import type OpenAI from 'openai'
import {
  listContainerFiles,
  readContainerFile,
  writeContainerFiles,
  remoteExec,
} from '../lib/environment-client.js'
import { applySearchReplace } from './apply-edit.js'

/** Cap on how much of a file / command output we feed back into the model, to bound context growth. */
const MAX_READ_CHARS = 12_000
const MAX_CMD_OUTPUT_CHARS = 8_000
const MAX_LIST = 400

/** OpenAI-style function tool schemas the agent may call. */
export const AGENT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List the project files (optionally under a directory prefix).',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'Optional directory prefix, e.g. "src/components".' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file. Optionally pass 1-based line range start/end. Always read before editing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          start: { type: 'integer', description: '1-based first line (optional).' },
          end: { type: 'integer', description: '1-based last line, inclusive (optional).' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Replace an exact snippet in a file. "search" MUST be copied verbatim from read_file output ' +
        '(exact characters and indentation) and be unique in the file. Prefer this over write_file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          search: { type: 'string', description: 'Exact snippet to replace.' },
          replace: { type: 'string', description: 'Replacement text.' },
        },
        required: ['path', 'search', 'replace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or fully overwrite an existing one with the given content.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a shell command in the project workspace (e.g. "npm run build", "ls", "cat"). Returns exit code + output. Use to verify your changes.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Call when the requested change is complete. Provide a one-sentence summary of what you did.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
  },
]

/** Read-only subset given to exploration sub-agents — no writes, no shell, can't change anything. */
export const EXPLORE_TOOLS: OpenAI.Chat.ChatCompletionTool[] = AGENT_TOOLS.filter(
  (t) => t.type === 'function' && ['list_files', 'read_file', 'finish'].includes(t.function.name),
)

/** Tool the main agent uses to hand a bounded, read-only investigation to a sub-agent. */
export const DELEGATE_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'delegate',
    description:
      'Delegate a READ-ONLY investigation to a sub-agent that explores the codebase in its own context ' +
      'and returns a concise report. Use for "where is X handled?" / "find everything related to Y" on a ' +
      'large or unfamiliar project, instead of reading many files yourself. The sub-agent cannot modify anything.',
    parameters: {
      type: 'object',
      properties: {
        instruction: { type: 'string', description: 'What to investigate and report back on.' },
      },
      required: ['instruction'],
    },
  },
}

export type ToolExecResult = {
  /** Text fed back to the model as the tool result. */
  result: string
  /** Set by `finish`. */
  done?: boolean
  summary?: string
  /** Path this call created/modified (for change tracking). */
  touched?: string
  /** Content of `touched` BEFORE this call (null = newly created), for accurate diffs. */
  prior?: string | null
}

function parseArgs(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…(truncated, ${s.length - max} more chars)` : s
}

/** Execute one tool call against the project container. Never throws — errors come back as text the model can react to. */
export async function executeAgentTool(envId: string, name: string, rawArgs: string): Promise<ToolExecResult> {
  const args = parseArgs(rawArgs)
  if (!args) return { result: `Error: could not parse arguments for ${name}. Send valid JSON.` }

  try {
    switch (name) {
      case 'list_files': {
        // Normalize to a clean relative prefix; ".", "./", "/" and "" all mean the project root.
        let dir = typeof args.dir === 'string' ? args.dir.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '') : ''
        if (dir === '.') dir = ''
        const all = await listContainerFiles(envId)
        const filtered = dir ? all.filter((p) => p === dir || p.startsWith(`${dir}/`)) : all
        const shown = filtered.slice(0, MAX_LIST)
        const more = filtered.length > shown.length ? `\n…(${filtered.length - shown.length} more)` : ''
        return { result: shown.length ? shown.join('\n') + more : '(no files)' }
      }
      case 'read_file': {
        const path = String(args.path ?? '')
        if (!path) return { result: 'Error: path is required.' }
        const content = await readContainerFile(envId, path)
        if (content === null) return { result: `Error: ${path} not found.` }
        const start = typeof args.start === 'number' ? args.start : null
        const end = typeof args.end === 'number' ? args.end : null
        if (start !== null) {
          const lines = content.split('\n')
          const slice = lines.slice(Math.max(0, start - 1), end ?? lines.length).join('\n')
          return { result: truncate(slice, MAX_READ_CHARS) }
        }
        return { result: truncate(content, MAX_READ_CHARS) }
      }
      case 'edit_file': {
        const path = String(args.path ?? '')
        const search = typeof args.search === 'string' ? args.search : ''
        const replace = typeof args.replace === 'string' ? args.replace : ''
        if (!path || !search) return { result: 'Error: path and search are required.' }
        const current = await readContainerFile(envId, path)
        if (current === null) {
          return { result: `Error: ${path} does not exist. Use write_file to create it, or list_files to find the right path.` }
        }
        const next = applySearchReplace(current, search, replace)
        if (next === null) {
          return {
            result: `Error: the "search" text was not found (or was ambiguous) in ${path}. Re-read the file with read_file and copy the exact text, including indentation.`,
          }
        }
        await writeContainerFiles(envId, [{ path, content: next }])
        return { result: `Edited ${path}.`, touched: path, prior: current }
      }
      case 'write_file': {
        const path = String(args.path ?? '')
        const content = typeof args.content === 'string' ? args.content : null
        if (!path || content === null) return { result: 'Error: path and content are required.' }
        const prior = await readContainerFile(envId, path)
        await writeContainerFiles(envId, [{ path, content }])
        return { result: `Wrote ${path} (${content.length} bytes).`, touched: path, prior }
      }
      case 'run_command': {
        const command = String(args.command ?? '')
        if (!command) return { result: 'Error: command is required.' }
        const { output, exitCode } = await remoteExec(envId, command, 120_000)
        return { result: `exit code: ${exitCode}\n${truncate(output || '(no output)', MAX_CMD_OUTPUT_CHARS)}` }
      }
      case 'finish': {
        const summary = typeof args.summary === 'string' && args.summary.trim() ? args.summary.trim() : 'Completed the requested change.'
        return { result: 'Done.', done: true, summary }
      }
      default:
        return { result: `Error: unknown tool ${name}.` }
    }
  } catch (err) {
    return { result: `Error running ${name}: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** Short human label for the progress line, from a tool call. */
export function toolActivityLabel(name: string, rawArgs: string): string {
  const args = parseArgs(rawArgs) ?? {}
  switch (name) {
    case 'list_files': {
      const d = typeof args.dir === 'string' ? args.dir.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '') : ''
      return d && d !== '.' ? `Listing ${d}` : 'Listing files'
    }
    case 'read_file':
      return `Reading ${String(args.path ?? '')}`
    case 'edit_file':
      return `Editing ${String(args.path ?? '')}`
    case 'write_file':
      return `Writing ${String(args.path ?? '')}`
    case 'run_command':
      return `Running ${String(args.command ?? '').slice(0, 60)}`
    case 'finish':
      return 'Finishing up'
    default:
      return 'Working'
  }
}
