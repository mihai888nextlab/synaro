import { remoteExecTerminal } from "@/lib/environment-service-api";

const WORKSPACE_ROOT = "/tmp/synaro-workspace/app";
const MAX_TERMINAL_COMMAND_LEN = 7_500;

export function sanitizeWorkspaceRelativePath(p: string): string | null {
  const t = p.trim().replace(/^\.\/+/, "").replace(/\\/g, "/");
  if (!t || t.includes("..") || t.startsWith("/")) return null;
  if (!/^[a-zA-Z0-9_./~-]+$/.test(t)) return null;
  return t;
}

function shQuote(rel: string): string {
  return `'${rel.replace(/'/g, `'\"'\"'`)}'`;
}

async function execInWorkspace(envId: string, script: string): Promise<void> {
  if (script.length > MAX_TERMINAL_COMMAND_LEN) {
    throw new Error("Operation too large for the workspace shell");
  }
  const result = await remoteExecTerminal(envId, `cd ${shQuote(WORKSPACE_ROOT)} && ${script}`);
  if (result.exitCode !== 0 && result.exitCode !== null) {
    const detail = result.output?.trim();
    throw new Error(detail || `Workspace command failed (exit ${result.exitCode})`);
  }
}

export async function terminalDeleteWorkspacePath(envId: string, relativePath: string): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath);
  if (!safe) throw new Error("Invalid path");
  await execInWorkspace(
    envId,
    `if test -e ${shQuote(safe)}; then rm -rf -- ${shQuote(safe)}; else exit 3; fi`,
  );
}

export async function terminalCreateWorkspaceDirectory(
  envId: string,
  relativePath: string,
): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath);
  if (!safe) throw new Error("Invalid path");
  await execInWorkspace(envId, `mkdir -p -- ${shQuote(safe)}`);
}

export async function terminalRenameWorkspacePath(
  envId: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  const fromSafe = sanitizeWorkspaceRelativePath(fromPath);
  const toSafe = sanitizeWorkspaceRelativePath(toPath);
  if (!fromSafe || !toSafe) throw new Error("Invalid path");
  await execInWorkspace(
    envId,
    `if test -e ${shQuote(fromSafe)}; then mkdir -p -- "$(dirname ${shQuote(toSafe)})" && mv -- ${shQuote(fromSafe)} ${shQuote(toSafe)}; else exit 3; fi`,
  );
}

export async function terminalWriteWorkspaceFile(
  envId: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const safe = sanitizeWorkspaceRelativePath(relativePath);
  if (!safe) throw new Error("Invalid path");
  const b64 = Buffer.from(content, "utf8").toString("base64");
  const script = `mkdir -p -- "$(dirname ${shQuote(safe)})" && printf '%s' ${shQuote(b64)} | base64 -d > ${shQuote(safe)}`;
  await execInWorkspace(envId, script);
}
