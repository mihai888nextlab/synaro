"use client";

import * as React from "react";
import { FileIcon } from "lucide-react";

import {
  isLikelyWorkspaceFilePath,
  normalizeWorkspaceFilePath,
  splitTextWithFilePaths,
} from "@/lib/workspace-file-link";
import { cn } from "@/lib/utils";

type Node =
  | { type: "text"; text: string }
  | { type: "strong"; children: Node[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Node[] };

function parseInline(md: string): Node[] {
  const out: Node[] = [];
  let i = 0;

  const pushText = (text: string) => {
    if (text) out.push({ type: "text", text });
  };

  while (i < md.length) {
    // code span: `...`
    if (md[i] === "`") {
      const end = md.indexOf("`", i + 1);
      if (end !== -1) {
        const text = md.slice(i + 1, end);
        out.push({ type: "code", text });
        i = end + 1;
        continue;
      }
    }

    // strong: **...**
    if (md[i] === "*" && md[i + 1] === "*") {
      const end = md.indexOf("**", i + 2);
      if (end !== -1) {
        const inner = md.slice(i + 2, end);
        out.push({ type: "strong", children: parseInline(inner) });
        i = end + 2;
        continue;
      }
    }

    // link: [text](href)
    if (md[i] === "[") {
      const closeBracket = md.indexOf("]", i + 1);
      const openParen = closeBracket !== -1 ? md.indexOf("(", closeBracket + 1) : -1;
      const closeParen = openParen !== -1 ? md.indexOf(")", openParen + 1) : -1;
      if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
        const label = md.slice(i + 1, closeBracket);
        const href = md.slice(openParen + 1, closeParen);
        out.push({ type: "link", href, children: parseInline(label) });
        i = closeParen + 1;
        continue;
      }
    }

    // plain text chunk
    const nextSpecials = [
      md.indexOf("`", i),
      md.indexOf("**", i),
      md.indexOf("[", i),
    ].filter((n) => n !== -1);
    const next = nextSpecials.length ? Math.min(...nextSpecials) : -1;
    if (next === -1) {
      pushText(md.slice(i));
      break;
    }
    pushText(md.slice(i, next));
    i = next;
  }

  return out;
}

function FilePathButton({
  path,
  onOpenFile,
}: {
  path: string;
  onOpenFile: (path: string) => void;
}) {
  const normalized = normalizeWorkspaceFilePath(path);
  return (
    <button
      type="button"
      onClick={() => onOpenFile(normalized)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-1.5 py-0.5",
        "font-mono text-[0.85em] text-primary underline-offset-2 transition",
        "hover:border-primary/40 hover:bg-primary/10 hover:underline",
      )}
      title={`Open ${normalized}`}
    >
      <FileIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      <span className="truncate">{path}</span>
    </button>
  );
}

function renderTextWithFileLinks(
  text: string,
  keyPrefix: string,
  onOpenFile?: (path: string) => void,
): React.ReactNode {
  if (!onOpenFile) {
    return <React.Fragment key={keyPrefix}>{text}</React.Fragment>;
  }

  const parts = splitTextWithFilePaths(text);
  if (parts.length === 1 && parts[0]?.type === "text") {
    return <React.Fragment key={keyPrefix}>{text}</React.Fragment>;
  }

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-t-${idx}`;
    if (part.type === "file") {
      return <FilePathButton key={key} path={part.value} onOpenFile={onOpenFile} />;
    }
    return <React.Fragment key={key}>{part.value}</React.Fragment>;
  });
}

function renderNodes(
  nodes: Node[],
  keyPrefix: string,
  onOpenFile?: (path: string) => void,
): React.ReactNode {
  return nodes.map((n, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (n.type) {
      case "text":
        return (
          <React.Fragment key={key}>
            {renderTextWithFileLinks(n.text, key, onOpenFile)}
          </React.Fragment>
        );
      case "code":
        if (onOpenFile && isLikelyWorkspaceFilePath(n.text)) {
          return <FilePathButton key={key} path={n.text} onOpenFile={onOpenFile} />;
        }
        return (
          <code
            key={key}
            className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[0.85em]"
          >
            {n.text}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderNodes(n.children, key, onOpenFile)}
          </strong>
        );
      case "link": {
        const href = n.href.trim();
        const openAsFile =
          onOpenFile &&
          !/^https?:\/\//i.test(href) &&
          !href.startsWith("mailto:") &&
          isLikelyWorkspaceFilePath(href);
        if (openAsFile) {
          return (
            <FilePathButton
              key={key}
              path={href}
              onOpenFile={onOpenFile}
            />
          );
        }
        return (
          <a
            key={key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {renderNodes(n.children, key, onOpenFile)}
          </a>
        );
      }
    }
  });
}

function buildMarkdownBlocks(text: string, onOpenFile?: (path: string) => void): React.ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let inCode = false;
  let codeAcc: string[] = [];

  function flushCode() {
    if (codeAcc.length === 0) return;
    const code = codeAcc.join("\n");
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="mt-3 overflow-x-auto rounded-xl border border-border/60 bg-zinc-950/80 p-3 text-left font-mono text-[0.75rem] leading-relaxed text-zinc-100 sm:text-xs"
      >
        <code>{code}</code>
      </pre>,
    );
    codeAcc = [];
  }

  let listAcc: string[] = [];
  function flushList() {
    if (listAcc.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mt-2 space-y-1.5 pl-4 text-sm text-muted-foreground">
        {listAcc.map((item, i) => (
          <li key={i} className="list-disc">
            {renderNodes(parseInline(item), `li-${blocks.length}-${i}`, onOpenFile)}
          </li>
        ))}
      </ul>,
    );
    listAcc = [];
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] ?? "";

    if (line.trim().startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeAcc.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1]!.length;
      const content = headingMatch[2] ?? "";
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(
        React.createElement(
          Tag,
          {
            key: `h-${blocks.length}`,
            className:
              level === 1
                ? "mt-3 text-base font-semibold tracking-tight text-foreground"
                : "mt-3 text-sm font-semibold text-foreground",
          },
          renderNodes(parseInline(content), `h-${blocks.length}`, onOpenFile),
        ),
      );
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      listAcc.push(listMatch[1] ?? "");
      continue;
    }

    if (line.trim() === "") {
      flushList();
      blocks.push(<div key={`sp-${blocks.length}`} className="h-2" />);
      continue;
    }

    flushList();
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground"
      >
        {renderNodes(parseInline(line), `p-${blocks.length}`, onOpenFile)}
      </p>,
    );
  }

  flushList();
  flushCode();
  return blocks;
}

export const MarkdownLite = React.memo(function MarkdownLite({
  text,
  className,
  onOpenFile,
}: {
  text: string;
  className?: string;
  onOpenFile?: (path: string) => void;
}) {
  const blocks = React.useMemo(
    () => buildMarkdownBlocks(text, onOpenFile),
    [text, onOpenFile],
  );
  return <div className={cn("text-left", className)}>{blocks}</div>;
});

