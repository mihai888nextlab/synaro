const CREDENTIAL_KEYS = new Set(["mcp_auth", "mcpAuth", "credentials", "runtime_auth", "runtimeAuth"]);

/** Known agent-service write fields: accept snake_case aliases from public API clients. */
const SNAKE_TO_CAMEL: Record<string, string> = {
  system_prompt: "systemPrompt",
  tool_mode: "toolMode",
  max_steps: "maxSteps",
  email_on_complete: "emailOnComplete",
  mcp_servers: "mcpServers",
  project_id: "projectId",
  user_id: "userId",
};

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

function normalizeAgentKeys(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const camel = SNAKE_TO_CAMEL[key] ?? key;
    // Prefer explicit camelCase if both were sent
    if (camel !== key && camel in body) continue;
    out[camel] = value;
  }
  return out;
}

/** Reject persisted MCP credentials; strip Authorization from MCP server headers; normalize snake→camel. */
export function sanitizePublicAgentBody(body: Record<string, unknown>): {
  ok: true;
  body: Record<string, unknown>;
} | { ok: false; error: string } {
  for (const key of Object.keys(body)) {
    if (CREDENTIAL_KEYS.has(key)) {
      return { ok: false, error: "credentials_not_allowed_in_agent_body" };
    }
  }

  const out = normalizeAgentKeys({ ...body });
  if ("mcpServers" in out) out.mcpServers = sanitizeMcpServers(out.mcpServers);
  return { ok: true, body: out };
}
