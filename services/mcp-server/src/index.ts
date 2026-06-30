#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { SynaroApiClient } from "./client.js";

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function main() {
  const client = new SynaroApiClient();

  const server = new McpServer({
    name: "synaro",
    version: "0.1.0",
  });

  server.tool(
    "create_project",
    "Create a Synaro project and provision its Docker environment.",
    {
      name: z.string().min(1).max(120).describe("Project display name"),
      description: z.string().optional().describe("Optional short description"),
      repository_url: z
        .string()
        .url()
        .optional()
        .describe("Optional GitHub repo URL to clone into the workspace"),
      docker_image: z
        .string()
        .optional()
        .describe('Docker base image or "automatic" (default)'),
    },
    async (args) => textResult(await client.createProject(args)),
  );

  server.tool(
    "deploy_project",
    "Start the project container and run the app (npm dev/start) inside it.",
    {
      project_id: z.string().uuid().describe("Synaro project ID"),
      wait_until_ready: z
        .boolean()
        .optional()
        .default(true)
        .describe("Poll until port 3000 is listening in the container"),
      timeout_seconds: z
        .number()
        .int()
        .min(5)
        .max(300)
        .optional()
        .default(120)
        .describe("Max seconds to wait when wait_until_ready is true"),
    },
    async (args) =>
      textResult(
        await client.deployProject(args.project_id, {
          wait_until_ready: args.wait_until_ready,
          timeout_seconds: args.timeout_seconds,
        }),
      ),
  );

  server.tool(
    "get_logs",
    "Fetch runtime app logs from the project container or AI task progress.",
    {
      project_id: z.string().uuid().describe("Synaro project ID"),
      source: z
        .enum(["runtime", "task"])
        .optional()
        .default("runtime")
        .describe("runtime = /tmp/app.log; task = AI task stream/progress"),
      task_id: z.string().uuid().optional().describe("Required when source=task"),
      lines: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(150)
        .describe("Number of log lines for runtime source"),
    },
    async (args) =>
      textResult(
        await client.getLogs(args.project_id, {
          source: args.source,
          task_id: args.task_id,
          lines: args.lines,
        }),
      ),
  );

  server.tool(
    "create_agent",
    "Start an AI coding or Q&A task on a project (Synaro AI task).",
    {
      project_id: z.string().uuid().describe("Synaro project ID"),
      prompt: z.string().min(1).describe("What the agent should do or answer"),
      mode: z
        .enum(["generate", "answer"])
        .optional()
        .default("generate")
        .describe("generate = code changes; answer = read-only Q&A"),
    },
    async (args) =>
      textResult(
        await client.createAgent(args.project_id, {
          prompt: args.prompt,
          mode: args.mode,
        }),
      ),
  );

  server.tool(
    "run_agent",
    "Poll an AI task until completion and return summary, changes, and git info.",
    {
      task_id: z.string().uuid().describe("Task ID from create_agent"),
      wait: z
        .boolean()
        .optional()
        .default(true)
        .describe("Block until DONE or FAILED"),
      timeout_seconds: z
        .number()
        .int()
        .min(5)
        .max(600)
        .optional()
        .default(300)
        .describe("Max wait time when wait=true"),
    },
    async (args) =>
      textResult(
        await client.runAgent(args.task_id, {
          wait: args.wait,
          timeout_seconds: args.timeout_seconds,
        }),
      ),
  );

  server.tool(
    "get_system_status",
    "Health of Synaro platform services and optional project runtime status.",
    {
      project_id: z
        .string()
        .uuid()
        .optional()
        .describe("Include per-project environment and run readiness"),
    },
    async (args) => textResult(await client.getSystemStatus(args.project_id)),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
