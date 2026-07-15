import type { FastifyBaseLogger } from 'fastify'
import { webSearch } from './web-search.js'
import { httpGet, httpPost } from './http.js'
import { synaroPlatformTools } from './synaro-platform.js'
import { workspaceTools } from './workspace.js'
import { subAgentTools } from './sub-agent.js'
import { memoryTools } from './memory.js'
import { buildMcpTools } from './mcp.js'
import type { AgentTool, ToolContext } from './types.js'

export type { ToolContext } from './types.js'

/** Marker in an agent's `tools` list that enables its configured MCP servers. */
export const MCP_TOOL_NAME = 'mcp'

/** Built-in tools (web + HTTP + the terminal `finish` signal). */
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

/** Every statically-defined tool. MCP tools are added dynamically per run. */
export const STATIC_TOOLS: AgentTool[] = [
  ...builtinTools,
  ...synaroPlatformTools,
  ...workspaceTools,
  ...subAgentTools,
  ...memoryTools,
]

/** All valid tool names an agent may enable (static tools + the `mcp` marker). */
export const VALID_TOOL_NAMES: string[] = [
  ...STATIC_TOOLS.map((t) => t.definition.function.name),
  MCP_TOOL_NAME,
]

export interface Toolset {
  /** Enabled tools for this run (static allow-listed + MCP), as OpenAI definitions. */
  tools: AgentTool[]
  byName: Map<string, AgentTool>
  close: () => Promise<void>
}

interface AgentToolConfig {
  tools: string[]
  mcpServers: unknown
}

/** Build the concrete toolset for a run from the agent's config. */
export async function assembleToolset(
  agent: AgentToolConfig,
  log: FastifyBaseLogger,
): Promise<Toolset> {
  const enabled = STATIC_TOOLS.filter((t) => agent.tools.includes(t.definition.function.name))

  let mcpTools: AgentTool[] = []
  let close: () => Promise<void> = async () => {}
  if (agent.tools.includes(MCP_TOOL_NAME) && agent.mcpServers) {
    const session = await buildMcpTools(agent.mcpServers, log)
    mcpTools = session.tools
    close = session.close
  }

  const tools = [...enabled, ...mcpTools]
  const byName = new Map(tools.map((t) => [t.definition.function.name, t]))
  return { tools, byName, close }
}

export async function runTool(
  toolset: Toolset,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const tool = toolset.byName.get(name)
  if (!tool) return `Unknown tool: ${name}`
  return tool.execute(args, ctx)
}
