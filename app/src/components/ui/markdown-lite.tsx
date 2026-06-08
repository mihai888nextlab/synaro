"use client";

import * as React from "react";

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

function renderNodes(nodes: Node[], keyPrefix: string): React.ReactNode {
  return nodes.map((n, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (n.type) {
      case "text":
        return <React.Fragment key={key}>{n.text}</React.Fragment>;
      case "code":
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
            {renderNodes(n.children, key)}
          </strong>
        );
      case "link":
        return (
          <a
            key={key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {renderNodes(n.children, key)}
          </a>
        );
    }
  });
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = React.useMemo(() => text.replace(/\r\n/g, "\n").split("\n"), [text]);

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
            {renderNodes(parseInline(item), `li-${blocks.length}-${i}`)}
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
          renderNodes(parseInline(content), `h-${blocks.length}`),
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
        {renderNodes(parseInline(line), `p-${blocks.length}`)}
      </p>,
    );
  }

  flushList();
  flushCode();

  return <div className={cn("text-left", className)}>{blocks}</div>;
}

