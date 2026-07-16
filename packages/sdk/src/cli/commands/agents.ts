import type { CliContext } from "../util.js";
import { printJson } from "../util.js";

export async function runAgents(ctx: CliContext): Promise<number> {
  const [action, agentId, ...inputParts] = ctx.args;
  if (!action || action === "help") {
    ctx.io.stdout("Usage: synaro agents <list|get|run|trigger> [args]");
    return action ? 0 : 1;
  }

  switch (action) {
    case "list": {
      printJson(ctx.io, await ctx.client.agents.list());
      return 0;
    }
    case "get": {
      if (!agentId) throw new Error("agents get requires <agentId>");
      printJson(ctx.io, await ctx.client.agents.get(agentId));
      return 0;
    }
    case "trigger": {
      if (!agentId) throw new Error("agents trigger requires <agentId>");
      const input = inputParts.join(" ") || undefined;
      printJson(ctx.io, await ctx.client.agents.trigger(agentId, { input }));
      return 0;
    }
    case "run": {
      if (!agentId) throw new Error("agents run requires <agentId>");
      const input = inputParts.join(" ") || undefined;
      const run = await ctx.client.agents.run(agentId, input, {
        pollIntervalMs: 2_000,
      });
      printJson(ctx.io, run);
      return 0;
    }
    default:
      throw new Error(`Unknown agents command: ${action}`);
  }
}
