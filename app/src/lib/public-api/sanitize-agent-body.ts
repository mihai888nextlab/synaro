const CREDENTIAL_KEYS = new Set(["mcp_auth", "mcpAuth", "credentials", "runtime_auth", "runtimeAuth"]);

function stripAuthHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization") continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeMcpServers(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((item) => {
    if (!item || typeof item !== "object") return item;
    const server = { ...(item as Record<string, unknown>) };
    const headers = server.headers;
    if (headers && typeof headers === "object") {
      const safe = stripAuthHeaders(headers as Record<string, string>);
      if (safe) server.headers = safe;
      else delete server.headers;
    }
    return server;
  });
}

/** Reject persisted MCP credentials; strip Authorization from MCP server headers. */
export function sanitizePublicAgentBody(body: Record<string, unknown>): {
  ok: true;
  body: Record<string, unknown>;
} | { ok: false; error: string } {
  for (const key of Object.keys(body)) {
    if (CREDENTIAL_KEYS.has(key)) {
      return { ok: false, error: "credentials_not_allowed_in_agent_body" };
    }
  }

  const out = { ...body };
  if ("mcp_servers" in out) out.mcp_servers = sanitizeMcpServers(out.mcp_servers);
  if ("mcpServers" in out) out.mcpServers = sanitizeMcpServers(out.mcpServers);
  return { ok: true, body: out };
}
