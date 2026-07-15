import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { FastifyBaseLogger } from 'fastify'
import type { AgentTool } from './types.js'
import {
  isAuthError,
  McpCredentialRequiredError,
  mergeServerHeaders,
  type McpRuntimeAuth,
} from './mcp-credentials.js'

export interface McpServerConfig {
  name: string
  url: string
  transport?: 'http' | 'sse'
  headers?: Record<string, string>
}

export interface McpSession {
  tools: AgentTool[]
  close: () => Promise<void>
  errors: string[]
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

export async function buildMcpTools(
  raw: unknown,
  log: FastifyBaseLogger,
  runtimeAuth?: McpRuntimeAuth,
  options?: { promptForCredentials?: boolean },
): Promise<McpSession> {
  const servers = parseServers(raw)
  const clients: Client[] = []
  const tools: AgentTool[] = []
  const errors: string[] = []

  if (servers.length === 0) {
    errors.push('No MCP servers configured — add a JSON array with name and url.')
    return {
      tools,
      errors,
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

  for (const baseCfg of servers) {
    const mergedHeaders = mergeServerHeaders(baseCfg, runtimeAuth)
    const cfg: McpServerConfig = mergedHeaders ? { ...baseCfg, headers: mergedHeaders } : baseCfg
    const hasRuntimeAuth = Boolean(runtimeAuth?.[baseCfg.name]?.Authorization)

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
      const msg = err instanceof Error ? err.message : String(err)
      if (options?.promptForCredentials && isAuthError(err) && !hasRuntimeAuth && !cfg.headers?.Authorization) {
        throw new McpCredentialRequiredError(baseCfg.name, baseCfg.url, err)
      }
      errors.push(`${baseCfg.name}: ${msg}`)
      log.error({ err, server: cfg.name }, 'Failed to connect to MCP server — skipping')
    }
  }

  return {
    tools,
    errors,
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

export { McpCredentialRequiredError } from './mcp-credentials.js'
export type { McpRuntimeAuth } from './mcp-credentials.js'
