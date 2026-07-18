import type { FastifyBaseLogger } from 'fastify'
import { webSearch } from './web-search.js'
import { httpGet, httpPost } from './http.js'
import { synaroPlatformTools } from './synaro-platform.js'
import { workspaceTools } from './workspace.js'
import { subAgentTools } from './sub-agent.js'
import { memoryTools } from './memory.js'
import { buildMcpTools } from './mcp.js'
import type { McpRuntimeAuth } from './mcp-credentials.js'
import type { AgentTool, ToolContext } from './types.js'

export type { ToolContext } from './types.js'

/** Marker in manual mode that enables configured MCP servers. */
export const MCP_TOOL_NAME = 'mcp'

const builtinTools: AgentTool[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          'Search the web for current information. Use this to look up facts, recent events, or anything you are unsure about.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: 'The search query' } },
          required: ['query'],
        },
      },
    },
    execute: (args) => webSearch(String(args.query ?? '')),
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'http_get',
        description: 'Fetch content from a public URL via HTTP GET.',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'The public URL to fetch' } },
          required: ['url'],
        },
      },
    },
    execute: (args) => httpGet(String(args.url ?? '')),
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'http_post',
        description: 'Send an HTTP POST request to a public URL with a JSON body.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The public URL to POST to' },
            body: { type: 'object', description: 'JSON body to send' },
            headers: { type: 'object', description: 'Optional additional headers' },
          },
          required: ['url', 'body'],
        },
      },
    },
    execute: (args) =>
      httpPost(
        String(args.url ?? ''),
        (args.body as Record<string, unknown>) ?? {},
        args.headers as Record<string, string> | undefined,
      ),
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'finish',
        description: 'Signal that you have completed the task. Call this when you have a final answer.',
        parameters: {
          type: 'object',
          properties: {
            answer: { type: 'string', description: 'The final answer or result to return to the user' },
          },
          required: ['answer'],
        },
      },
    },
    execute: (args) => Promise.resolve(String(args.answer ?? '')),
  },
]

export const STATIC_TOOLS: AgentTool[] = [
  ...builtinTools,
  ...synaroPlatformTools,
  ...workspaceTools,
  ...subAgentTools,
  ...memoryTools,
]

export const VALID_TOOL_NAMES: string[] = [
  ...STATIC_TOOLS.map((t) => t.definition.function.name),
  MCP_TOOL_NAME,
]

export interface Toolset {
  tools: AgentTool[]
  byName: Map<string, AgentTool>
  close: () => Promise<void>
  wantsMcp: boolean
  mcpToolCount: number
  mcpErrors: string[]
}

interface AgentToolConfig {
  tools: string[]
  toolMode?: string | null
  mcpServers: unknown
}

function hasMcpServers(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0
}

function isAutoMode(agent: AgentToolConfig): boolean {
  return agent.toolMode !== 'manual'
}

/** Build the concrete toolset for a run from the agent's config. */
export async function assembleToolset(
  agent: AgentToolConfig,
  log: FastifyBaseLogger,
  mcpRuntimeAuth?: McpRuntimeAuth,
): Promise<Toolset> {
  const auto = isAutoMode(agent)
  const finishTool = STATIC_TOOLS.find((t) => t.definition.function.name === 'finish')!
  const enabled = auto
    ? STATIC_TOOLS
    : STATIC_TOOLS.filter((t) => agent.tools.includes(t.definition.function.name))

  let mcpTools: AgentTool[] = []
  let mcpErrors: string[] = []
  let close: () => Promise<void> = async () => {}

  const wantsMcp = auto
    ? hasMcpServers(agent.mcpServers)
    : agent.tools.includes(MCP_TOOL_NAME)

  if (wantsMcp && agent.mcpServers) {
    const session = await buildMcpTools(agent.mcpServers, log, mcpRuntimeAuth, {
      promptForCredentials: true,
    })
    mcpTools = session.tools
    mcpErrors = session.errors
    close = session.close
  } else if (wantsMcp && !auto) {
    mcpErrors = ['No MCP servers configured — add a JSON array with name and url.']
  }

  const tools = [...enabled, ...mcpTools]
  if (!tools.some((t) => t.definition.function.name === 'finish')) {
    tools.push(finishTool)
  }

  const byName = new Map(tools.map((t) => [t.definition.function.name, t]))
  return { tools, byName, close, wantsMcp, mcpToolCount: mcpTools.length, mcpErrors }
}

export async function runTool(
  toolset: Toolset,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const tool = toolset.byName.get(name)
  if (!tool) return `Unknown tool: ${name}`
  try {
    return await tool.execute(args, ctx)
  } catch (err) {
    // A throwing tool must not crash the whole run — feed the failure back as an
    // observation so the model can retry or finish, and name the tool for the logs.
    const message = err instanceof Error ? err.message : String(err)
    return `Error running tool "${name}": ${message}`
  }
}
