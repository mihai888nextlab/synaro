import type { CliContext } from "../util.js";
import { printJson } from "../util.js";

export async function runRuns(ctx: CliContext): Promise<number> {
  const [action, runId] = ctx.args;
  if (!action || action === "help") {
    ctx.io.stdout("Usage: synaro runs <get|wait|cancel> <runId>");
    return action ? 0 : 1;
  }

  if (!runId) throw new Error(`runs ${action} requires <runId>`);

  switch (action) {
    case "get": {
      printJson(ctx.io, await ctx.client.runs.get(runId));
      return 0;
    }
    case "wait": {
      printJson(ctx.io, await ctx.client.runs.wait(runId));
      return 0;
    }
    case "cancel": {
      printJson(ctx.io, await ctx.client.runs.cancel(runId));
      return 0;
    }
    default:
      throw new Error(`Unknown runs command: ${action}`);
  }
}
