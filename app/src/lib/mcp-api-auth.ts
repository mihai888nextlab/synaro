import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Machine-to-machine auth for MCP and automation clients.
 * Set SYNARO_API_KEY and SYNARO_MCP_USER_ID in the app environment.
 */
export function resolveMcpApiUserId(req: NextApiRequest): string | null {
  const expectedKey = process.env.SYNARO_API_KEY?.trim();
  const userId = process.env.SYNARO_MCP_USER_ID?.trim();
  if (!expectedKey || !userId) return null;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token !== expectedKey) return null;
  return userId;
}

export function requireMcpApiAuth(
  req: NextApiRequest,
  res: NextApiResponse,
): string | null {
  const userId = resolveMcpApiUserId(req);
  if (!userId) {
    res.status(401).json({
      error: "Unauthorized",
      detail: "Provide Authorization: Bearer <SYNARO_API_KEY>. Configure SYNARO_API_KEY and SYNARO_MCP_USER_ID on the app.",
    });
    return null;
  }
  return userId;
}
