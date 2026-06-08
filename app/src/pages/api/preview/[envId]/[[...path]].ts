import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function getEnvPort(envId: string): Promise<number | null> {
  const base = process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
  try {
    const res = await fetch(`${base}/api/environments/${envId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { port?: number | null };
    return typeof data.port === "number" ? data.port : null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { envId, path: pathSegments } = req.query;
  if (typeof envId !== "string") return res.status(400).end();

  const port = await getEnvPort(envId);
  if (!port) {
    return res.status(502).json({ error: "Environment not running or port unavailable." });
  }

  const pathStr = Array.isArray(pathSegments) ? pathSegments.join("/") : (pathSegments ?? "");
  const rawUrl = req.url ?? "";
  const qIdx = rawUrl.indexOf("?");
  const queryStr = qIdx !== -1 ? rawUrl.slice(qIdx) : "";
  const proxyHost = process.env.PREVIEW_PROXY_HOST?.trim() || "localhost";
  const targetUrl = `http://${proxyHost}:${port}/${pathStr}${queryStr}`;
  const prefix = `/api/preview/${envId}`;

  const forwardHeaders: Record<string, string> = {
    "accept-encoding": "identity",
    host: `${proxyHost}:${port}`,
  };
  if (req.headers.accept) forwardHeaders.accept = req.headers.accept as string;
  if (req.headers.cookie) forwardHeaders.cookie = req.headers.cookie as string;
  if (req.headers["content-type"]) forwardHeaders["content-type"] = req.headers["content-type"] as string;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return res.status(502).json({ error: "Preview environment unreachable." });
  }

  res.status(upstream.status);

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  res.setHeader("content-type", contentType);
  res.setHeader("x-preview-env", envId);

  const location = upstream.headers.get("location");
  if (location) {
    res.setHeader("location", location.startsWith("/") ? `${prefix}${location}` : location);
  }

  if (contentType.includes("text/html")) {
    const text = await upstream.text();
    const rewritten = text
      .replace(/(href|src|action|data-src)="\//g, `$1="${prefix}/`)
      .replace(/(href|src|action|data-src)='\//g, `$1='${prefix}/`)
      .replace(/url\(["']?\//g, `url(${prefix}/`);
    return res.send(rewritten);
  }

  if (contentType.includes("text/css")) {
    const text = await upstream.text();
    return res.send(text.replace(/url\(["']?\//g, `url(${prefix}/`));
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
