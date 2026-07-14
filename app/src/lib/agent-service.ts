function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

function agentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

export type PublicAgent = {
  id: string;
  name: string;
  description?: string | null;
  tools: string[];
  enabled: boolean;
};

export async function fetchPublicAgent(agentId: string): Promise<PublicAgent | null> {
  try {
    const upstream = await fetch(`${agentServiceUrl()}/api/agents/${encodeURIComponent(agentId)}`, {
      headers: agentHeaders(),
    });
    if (!upstream.ok) return null;

    const data = (await upstream.json()) as {
      id?: string;
      name?: string;
      description?: string | null;
      tools?: string[];
      enabled?: boolean;
    };

    if (!data.id || !data.name) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description ?? null,
      tools: Array.isArray(data.tools) ? data.tools.filter((tool) => tool !== "finish") : [],
      enabled: data.enabled ?? false,
    };
  } catch {
    return null;
  }
}
