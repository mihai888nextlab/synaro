import type { CliContext } from "../util.js";
import { printJson } from "../util.js";

export async function runMe(ctx: CliContext): Promise<number> {
  const me = await ctx.client.me();
  printJson(ctx.io, me);
  return 0;
}
