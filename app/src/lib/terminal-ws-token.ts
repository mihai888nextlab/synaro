import crypto from "node:crypto";

export type TerminalWsTokenPayload = {
  environmentId: string;
  projectId: string;
  userId: string;
  exp: number;
};

function terminalWsSecret(): string {
  const secret = process.env.TERMINAL_WS_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("TERMINAL_WS_SECRET or NEXTAUTH_SECRET must be set for container terminal access.");
  }
  return secret;
}

export function createTerminalWsToken(
  payload: Pick<TerminalWsTokenPayload, "environmentId" | "projectId" | "userId">,
  ttlSeconds = 120,
): string {
  const body: TerminalWsTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", terminalWsSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyTerminalWsToken(token: string): TerminalWsTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expected = crypto.createHmac("sha256", terminalWsSecret()).update(encoded).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: TerminalWsTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TerminalWsTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.environmentId !== "string" ||
    typeof payload.projectId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function environmentServiceTerminalWsUrl(environmentId: string): string {
  const base = process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
  const wsBase = base.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
  return `${wsBase}/api/environments/${encodeURIComponent(environmentId)}/terminal/ws`;
}
