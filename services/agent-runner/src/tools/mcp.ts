import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { FastifyBaseLogger } from 'fastify'
import type { AgentTool } from './types.js'

/**
 * MCP client integration. An agent may declare external MCP servers in its
 * `mcpServers` config; at run time we connect to each, discover its tools, and
 * expose them to the model as `mcp__{server}__{tool}`. A failed server is logged
 * and skipped so it never aborts the whole run. Sessions are closed after the run.
 *
 * This is an external trust surface — the agent's owner is responsible for the
 * servers they configure.
 */

export interface McpServerConfig {
  name: string
  url: string
  transport?: 'http' | 'sse'
  headers?: Record<string, string>
}

export interface McpSession {
  tools: AgentTool[]
  close: () => Promise<void>
}

function parseServers(raw: unknown): McpServerConfig[] {
  if (!Array.isArray(raw)) return []
  const out: McpServerConfig[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.name !== 'string' || typeof o.url !== 'string') continue
    out.push({
      name: o.name,
      url: o.url,
      transport: o.transport === 'sse' ? 'sse' : 'http',
      headers:
        o.headers && typeof o.headers === 'object'
          ? (o.headers as Record<string, string>)
          : undefined,
    })
  }
  return out
}

function extractText(result: unknown): string {
  const content = (result as { content?: unknown })?.content
  if (!Array.isArray(content)) return JSON.stringify(result)
  const parts = content
    .map((c) => {
      const part = c as { type?: string; text?: string }
      return part.type === 'text' ? (part.text ?? '') : `[${part.type ?? 'unknown'} content]`
    })
    .filter(Boolean)
  return parts.join('\n') || '(no content)'
}

async function connect(cfg: McpServerConfig): Promise<Client> {
  const client = new Client({ name: 'synaro-agent-runner', version: '1.0.0' })
  const url = new URL(cfg.url)
  const opts = cfg.headers ? { requestInit: { headers: cfg.headers } } : undefined
  const transport =
    cfg.transport === 'sse'
      ? new SSEClientTransport(url, opts)
      : new StreamableHTTPClientTransport(url, opts)
  await client.connect(transport)
  return client
}

export async function buildMcpTools(raw: unknown, log: FastifyBaseLogger): Promise<McpSession> {
  const servers = parseServers(raw)
  const clients: Client[] = []
  const tools: AgentTool[] = []

  for (const cfg of servers) {
    try {
      const client = await connect(cfg)
      clients.push(client)
      const listed = await client.listTools()
      for (const t of listed.tools) {
        const localName = `mcp__${cfg.name}__${t.name}`
        tools.push({
          definition: {
            type: 'function',
            function: {
              name: localName,
              description: t.description ?? `MCP tool ${t.name} from ${cfg.name}`,
              parameters: (t.inputSchema as Record<string, unknown>) ?? {
                type: 'object',
                properties: {},
              },
            },
          },
          async execute(args) {
            try {
              const result = await client.callTool({ name: t.name, arguments: args })
              return extractText(result)
            } catch (err) {
              return `Error calling ${localName}: ${String(err)}`
            }
          },
        })
      }
      log.info({ server: cfg.name, tools: listed.tools.length }, 'MCP server connected')
    } catch (err) {
      log.error({ err, server: cfg.name }, 'Failed to connect to MCP server — skipping')
    }
  }

  return {
    tools,
    close: async () => {
      for (const c of clients) {
        try {
          await c.close()
        } catch {
          /* best-effort */
        }
      }
    },
  }
}
