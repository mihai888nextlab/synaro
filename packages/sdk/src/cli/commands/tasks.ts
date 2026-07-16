import type { CliContext } from "../util.js";
import { printJson } from "../util.js";

export async function runTasks(ctx: CliContext): Promise<number> {
  const [action, first, ...rest] = ctx.args;
  if (!action || action === "help") {
    ctx.io.stdout("Usage: synaro tasks <run|get> [args]");
    return action ? 0 : 1;
  }

  switch (action) {
    case "run": {
      if (!first) throw new Error("tasks run requires <projectId> <prompt…>");
      const prompt = rest.join(" ").trim();
      if (!prompt) throw new Error("tasks run requires a prompt");
      printJson(ctx.io, await ctx.client.tasks.run(first, prompt));
      return 0;
    }
    case "get": {
      if (!first) throw new Error("tasks get requires <taskId>");
      printJson(ctx.io, await ctx.client.tasks.get(first));
      return 0;
    }
    default:
      throw new Error(`Unknown tasks command: ${action}`);
  }
}
