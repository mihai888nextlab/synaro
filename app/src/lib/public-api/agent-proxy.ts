function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}

function agentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

export async function proxyAgentService(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const upstream = await fetch(`${agentServiceUrl()}${path}`, {
    ...init,
    headers: { ...agentHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });

  if (upstream.status === 204) {
    return { status: 204, body: null };
  }

  const body = (await upstream.json().catch(() => ({}))) as unknown;
  return { status: upstream.status, body };
}
