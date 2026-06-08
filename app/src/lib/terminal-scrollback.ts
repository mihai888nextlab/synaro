import type { Terminal } from "@xterm/xterm";

/** Serialize xterm scrollback to plain text (ANSI styling is not preserved). */
export function captureTerminalScrollback(term: Terminal): string {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Restore plain-text scrollback into a terminal instance. */
export function restoreTerminalScrollback(term: Terminal, saved: string): void {
  const trimmed = saved.trimEnd();
  if (!trimmed) return;
  term.write(trimmed.replace(/\n/g, "\r\n") + "\r\n");
}
