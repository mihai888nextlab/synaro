import type { Synaro } from "../synaro.js";
import { NeedsInputError, SynaroError } from "../errors.js";

export type CliIo = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

export type CliContext = {
  client: Synaro;
  args: string[];
  flags: Set<string>;
  io: CliIo;
};

export function parseArgv(argv: string[]): { args: string[]; flags: Set<string> } {
  const args: string[] = [];
  const flags = new Set<string>();
  for (const token of argv) {
    if (token.startsWith("--")) flags.add(token.slice(2));
    else args.push(token);
  }
  return { args, flags };
}

export function printJson(io: CliIo, value: unknown): void {
  io.stdout(JSON.stringify(value, null, 2));
}

export function printError(io: CliIo, err: unknown): number {
  if (err instanceof NeedsInputError) {
    io.stderr(
      `needs_input: run ${err.runId} requires MCP credentials. Use the API runs.submitCredentials or dashboard.`,
    );
    return 2;
  }
  if (err instanceof SynaroError) {
    io.stderr(`${err.status}: ${err.message}`);
    return 1;
  }
  io.stderr(err instanceof Error ? err.message : String(err));
  return 1;
}

export const ROOT_HELP = `Usage: synaro <command> [options]

Commands:
  me                         Verify API key / identity
  projects list              List projects
  projects get <id>          Get a project
  projects create [name]     Create a project
  projects deploy <id>       Deploy a project [--no-wait]
  projects start <id>        Start environment
  projects stop <id>         Stop environment
  agents list                List agents
  agents get <id>            Get an agent
  agents run <id> [input…]   Trigger agent and wait
  agents trigger <id> [input…]  Trigger without waiting
  tasks run <projectId> <prompt…>  Create task and wait
  tasks get <taskId>         Get task (server-side wait)
  runs get <id>              Get a run
  runs wait <id>             Poll until terminal
  runs cancel <id>           Cancel an active run

Environment:
  SYNARO_API_KEY    Required Bearer key (sk_live_…)
  SYNARO_BASE_URL   Optional origin (default https://synaro.tech)

Global flags:
  --help            Show help
  --json            Pretty JSON (default for most commands)
`;
