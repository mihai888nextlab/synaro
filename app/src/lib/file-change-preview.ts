export type PreviewLineKind = "add" | "remove" | "context";

export type FileChangePreviewLine = {
  kind: PreviewLineKind;
  text: string;
};

export type FileChangePreview = {
  path: string;
  fileName: string;
  added: number;
  removed: number;
  lines: FileChangePreviewLine[];
};

export function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/** Line-level added/removed counts via LCS (good enough for UI badges). */
function lineDiffCounts(oldLines: string[], newLines: string[]): { added: number; removed: number } {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const lcs = dp[m]![n]!;
  return { added: n - lcs, removed: m - lcs };
}

function buildPreviewLines(oldLines: string[], newLines: string[]): FileChangePreviewLine[] {
  const maxLines = 6;
  const out: FileChangePreviewLine[] = [];

  let firstChange = 0;
  const minLen = Math.min(oldLines.length, newLines.length);
  while (firstChange < minLen && oldLines[firstChange] === newLines[firstChange]) {
    firstChange++;
  }

  if (firstChange >= oldLines.length && firstChange >= newLines.length) {
    return [{ kind: "context", text: "(no line changes)" }];
  }

  const ctxStart = Math.max(0, firstChange - 1);
  if (ctxStart < firstChange && oldLines[ctxStart] !== undefined) {
    out.push({ kind: "context", text: oldLines[ctxStart]! });
  }

  let i = firstChange;
  let j = firstChange;
  while (out.length < maxLines && (i < oldLines.length || j < newLines.length)) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = j < newLines.length ? newLines[j] : undefined;

    if (oldLine !== undefined && newLine !== undefined && oldLine === newLine) {
      out.push({ kind: "context", text: oldLine });
      i++;
      j++;
      continue;
    }

    if (oldLine !== undefined && (newLine === undefined || oldLine !== newLine)) {
      out.push({ kind: "remove", text: oldLine });
      i++;
      if (out.length >= maxLines) break;
    }

    if (newLine !== undefined && (oldLine === undefined || oldLine !== newLine)) {
      out.push({ kind: "add", text: newLine });
      j++;
    }
  }

  return out.length > 0 ? out : [{ kind: "add", text: newLines[0] ?? "" }];
}

export function buildFileChangePreview(
  path: string,
  content: string,
  previousContent?: string | null,
): FileChangePreview {
  const fileName = path.split("/").pop() || path;
  const newLines = splitLines(content);

  if (previousContent == null || previousContent === undefined) {
    const preview = newLines.slice(0, 6).map((text) => ({ kind: "add" as const, text }));
    return {
      path,
      fileName,
      added: newLines.length,
      removed: 0,
      lines: preview.length > 0 ? preview : [{ kind: "add", text: "" }],
    };
  }

  const oldLines = splitLines(previousContent);
  const { added, removed } = lineDiffCounts(oldLines, newLines);
  return {
    path,
    fileName,
    added,
    removed,
    lines: buildPreviewLines(oldLines, newLines),
  };
}
