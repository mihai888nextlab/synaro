// Minimal HTTP (Streamable HTTP transport) MCP server for testing Synaro agents.
// Exposes three trivial tools: echo, add, current_time.
//
// Runs on :9100 at /mcp. Reuses the agent-runner image (which already has
// @modelcontextprotocol/sdk + zod installed), so it needs no separate install.
//
// Stateless mode: a fresh server+transport per request — simplest, and fine for
// a test tool. Reachable from agent-runner on the compose network at
//   http://mcp-test:9100/mcp

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";

function buildServer() {
  const server = new McpServer({ name: "synaro-mcp-test", version: "1.0.0" });

  server.registerTool(
    "echo",
    { description: "Echo back the text you provide.", inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: "text", text: `echo: ${text}` }] }),
  );

  server.registerTool(
    "add",
    { description: "Add two numbers and return the sum.", inputSchema: { a: z.number(), b: z.number() } },
    async ({ a, b }) => ({ content: [{ type: "text", text: `${a} + ${b} = ${a + b}` }] }),
  );

  server.registerTool(
    "current_time",
    { description: "Get the current UTC time in ISO-8601.", inputSchema: {} },
    async () => ({ content: [{ type: "text", text: new Date().toISOString() }] }),
  );

  return server;
}

const httpServer = createServer((req, res) => {
  if (!req.url || !req.url.startsWith("/mcp")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    let body;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    } catch {
      body = undefined;
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
  });
});

const PORT = Number(process.env.PORT ?? 9100);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP test server listening on http://0.0.0.0:${PORT}/mcp`);
});
