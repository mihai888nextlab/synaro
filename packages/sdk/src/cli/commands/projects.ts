import type { CliContext } from "../util.js";
import { printJson } from "../util.js";

export async function runProjects(ctx: CliContext): Promise<number> {
  const [action, idOrName, ...rest] = ctx.args;
  if (!action || action === "help") {
    ctx.io.stdout(
      "Usage: synaro projects <list|get|create|deploy|start|stop> [args] [--no-wait]",
    );
    return action ? 0 : 1;
  }

  switch (action) {
    case "list": {
      printJson(ctx.io, await ctx.client.projects.list());
      return 0;
    }
    case "get": {
      if (!idOrName) throw new Error("projects get requires <projectId>");
      printJson(ctx.io, await ctx.client.projects.get(idOrName));
      return 0;
    }
    case "create": {
      const name = [idOrName, ...rest].filter(Boolean).join(" ") || undefined;
      printJson(ctx.io, await ctx.client.projects.create(name ? { name } : {}));
      return 0;
    }
    case "deploy": {
      if (!idOrName) throw new Error("projects deploy requires <projectId>");
      printJson(
        ctx.io,
        await ctx.client.projects.deploy(idOrName, {
          waitUntilReady: !ctx.flags.has("no-wait"),
        }),
      );
      return 0;
    }
    case "start": {
      if (!idOrName) throw new Error("projects start requires <projectId>");
      printJson(ctx.io, await ctx.client.projects.start(idOrName));
      return 0;
    }
    case "stop": {
      if (!idOrName) throw new Error("projects stop requires <projectId>");
      printJson(ctx.io, await ctx.client.projects.stop(idOrName));
      return 0;
    }
    default:
      throw new Error(`Unknown projects command: ${action}`);
  }
}
