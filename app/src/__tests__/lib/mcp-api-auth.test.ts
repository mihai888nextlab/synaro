import type { NextApiRequest } from "next";

import { resolveMcpApiUserId } from "@/lib/mcp-api-auth";

function mockReq(auth?: string): NextApiRequest {
  return {
    headers: auth ? { authorization: auth } : {},
  } as NextApiRequest;
}

describe("mcp-api-auth", () => {
  const prevKey = process.env.SYNARO_API_KEY;
  const prevUser = process.env.SYNARO_MCP_USER_ID;

  beforeEach(() => {
    process.env.SYNARO_API_KEY = "test-secret-key";
    process.env.SYNARO_MCP_USER_ID = "user-123";
  });

  afterEach(() => {
    process.env.SYNARO_API_KEY = prevKey;
    process.env.SYNARO_MCP_USER_ID = prevUser;
  });

  it("returns user id for valid bearer token", () => {
    expect(resolveMcpApiUserId(mockReq("Bearer test-secret-key"))).toBe("user-123");
  });

  it("rejects missing or wrong token", () => {
    expect(resolveMcpApiUserId(mockReq())).toBeNull();
    expect(resolveMcpApiUserId(mockReq("Bearer wrong"))).toBeNull();
  });
});
