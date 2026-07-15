/** Thrown when an MCP server needs credentials the user must supply at run time. */
export class McpCredentialRequiredError extends Error {
  readonly serverName: string
  readonly serverUrl: string

  constructor(serverName: string, serverUrl: string, cause?: unknown) {
    const detail = cause instanceof Error ? cause.message : cause ? String(cause) : 'Authentication required'
    super(`MCP server "${serverName}" requires credentials: ${detail}`)
    this.name = 'McpCredentialRequiredError'
    this.serverName = serverName
    this.serverUrl = serverUrl
  }
}

export type McpCredentialField = {
  key: string
  label: string
  type: 'password' | 'text'
  placeholder?: string
}

export type McpCredentialRequest = {
  server: string
  url: string
  fields: McpCredentialField[]
}

/** Per-server auth headers supplied for a single run (never persisted). */
export type McpRuntimeAuth = Record<string, Record<string, string>>

export function buildCredentialRequest(serverName: string, serverUrl: string): McpCredentialRequest {
  return {
    server: serverName,
    url: serverUrl,
    fields: [
      {
        key: 'Authorization',
        label: 'Access token',
        type: 'password',
        placeholder: 'Bearer ghp_… or your MCP token',
      },
    ],
  }
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    msg.includes('authorization') ||
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('authentication')
  )
}

export function mergeServerHeaders(
  cfg: { name: string; headers?: Record<string, string> },
  runtimeAuth: McpRuntimeAuth | undefined,
): Record<string, string> | undefined {
  const runtime = runtimeAuth?.[cfg.name]
  if (!cfg.headers && !runtime) return undefined
  return { ...cfg.headers, ...runtime }
}

export { isAuthError }
