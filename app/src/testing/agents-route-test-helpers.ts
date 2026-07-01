import { afterEach, beforeEach, jest } from "@jest/globals";
import { getServerSession } from "next-auth/next";

export const getServerSessionMock = getServerSession as jest.MockedFunction<typeof getServerSession>;

const origFetch = globalThis.fetch;
const origAgentKey = process.env.AGENT_SERVICE_KEY;
const origAgentUrl = process.env.AGENT_SERVICE_URL;

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Shared env + fetch mock for session `/api/agents/*` route tests. */
export function setupAgentServiceRouteTests(): () => jest.Mock {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGENT_SERVICE_KEY = "test-agent-key";
    process.env.AGENT_SERVICE_URL = "http://agent-service.test";
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    process.env.AGENT_SERVICE_KEY = origAgentKey;
    process.env.AGENT_SERVICE_URL = origAgentUrl;
  });

  return () => globalThis.fetch as jest.Mock;
}
