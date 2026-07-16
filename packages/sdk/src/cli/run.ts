import type { Synaro } from "../synaro.js";
import { createCliClient } from "./client.js";
import { runAgents } from "./commands/agents.js";
import { runMe } from "./commands/me.js";
import { runProjects } from "./commands/projects.js";
import { runRuns } from "./commands/runs.js";
import { runTasks } from "./commands/tasks.js";
import {
  parseArgv,
  printError,
  ROOT_HELP,
  type CliContext,
  type CliIo,
} from "./util.js";

export type RunCliOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
  client?: Synaro;
};

/**
 * CLI entry used by the `synaro` bin and by unit tests (injectable client).
 */
export async function runCli(opts: RunCliOptions = {}): Promise<number> {
  const argv = opts.argv ?? process.argv.slice(2);
  const io: CliIo = opts.io ?? {
    stdout: (line) => {
      process.stdout.write(`${line}\n`);
    },
    stderr: (line) => {
      process.stderr.write(`${line}\n`);
    },
  };

  const { args, flags } = parseArgv(argv);
  if (args.length === 0 || flags.has("help") || args[0] === "help") {
    io.stdout(ROOT_HELP);
    return 0;
  }

  let client: Synaro;
  try {
    client = opts.client ?? createCliClient(opts.env ?? process.env);
  } catch (err) {
    return printError(io, err);
  }

  const [group, ...rest] = args;
  const ctx: CliContext = { client, args: rest, flags, io };

  try {
    switch (group) {
      case "me":
        return await runMe(ctx);
      case "projects":
        return await runProjects(ctx);
      case "agents":
        return await runAgents(ctx);
      case "tasks":
        return await runTasks(ctx);
      case "runs":
        return await runRuns(ctx);
      default:
        io.stderr(`Unknown command: ${group}`);
        io.stdout(ROOT_HELP);
        return 1;
    }
  } catch (err) {
    return printError(io, err);
  }
}

export { createCliClient } from "./client.js";
export { parseArgv, ROOT_HELP } from "./util.js";
