export type ProjectTerminalExecResponse = {
  output: string;
  exitCode: number | null;
  cwd: string;
};

export type ProjectTerminalInactiveReason =
  | "no_environment"
  | "not_active"
  | "unreachable";

export type ProjectTerminalApiResponse =
  | ({ ok: true } & ProjectTerminalExecResponse)
  | { ok: false; error: string; reason?: ProjectTerminalInactiveReason };
