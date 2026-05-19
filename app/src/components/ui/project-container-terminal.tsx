"use client";

import * as React from "react";
import { Loader2, TerminalSquare } from "lucide-react";

import type { SynaroProjectEnvironmentStatus } from "@/components/ui/project-cards-grid";
import {
  readTerminalScrollback,
  writeTerminalScrollback,
} from "@/lib/dashboard-workflow-storage";
import {
  captureTerminalScrollback,
  restoreTerminalScrollback,
} from "@/lib/terminal-scrollback";
import { cn } from "@/lib/utils";

type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

export function ProjectContainerTerminal({
  projectId,
  environmentStatus,
  visible = true,
  className,
}: {
  projectId?: string;
  environmentStatus: SynaroProjectEnvironmentStatus;
  /** When false, terminal stays connected but hidden (e.g. another workspace tab is active). */
  visible?: boolean;
  className?: string;
}) {
  const running = environmentStatus === "RUNNING";
  const hostRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitRef = React.useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const dataDisposableRef = React.useRef<{ dispose: () => void } | null>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  const [connection, setConnection] = React.useState<ConnectionState>("idle");
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const sendResize = React.useCallback(() => {
    const ws = wsRef.current;
    const term = termRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !term) return;
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
  }, []);

  const persistScrollback = React.useCallback(() => {
    if (!projectId) return;
    const term = termRef.current;
    if (!term) return;
    writeTerminalScrollback(projectId, captureTerminalScrollback(term));
  }, [projectId]);

  const disconnect = React.useCallback(() => {
    persistScrollback();
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    dataDisposableRef.current?.dispose();
    dataDisposableRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    fitRef.current = null;
  }, [persistScrollback]);

  const inactiveMessage = !running
    ? "Start the container to attach an interactive shell."
    : !projectId
      ? "Project not loaded."
      : null;

  const headerStatus =
    !running || !projectId
      ? "offline"
      : connection === "open"
        ? "live shell"
        : connection;

  React.useEffect(() => {
    if (!running || !projectId) {
      disconnect();
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setConnection("connecting");
        setErrorText(null);
      }
    });

    void (async () => {
      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/xterm/css/xterm.css"),
        ]);

        if (cancelled || !hostRef.current) return;

        disconnect();

        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          theme: {
            background: "#09090b",
            foreground: "#e4e4e7",
            cursor: "#4ade80",
            selectionBackground: "#3f3f46",
          },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fit.fit();
        termRef.current = term;
        fitRef.current = fit;

        const savedScrollback = projectId ? readTerminalScrollback(projectId) : null;
        if (savedScrollback) restoreTerminalScrollback(term, savedScrollback);

        const sessionRes = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/terminal/session`,
          { method: "POST" },
        );
        const session = (await sessionRes.json().catch(() => null)) as
          | { ok: true; wsUrl: string; token: string }
          | { ok: false; error?: string }
          | null;

        if (cancelled) return;

        if (!sessionRes.ok || !session || !session.ok) {
          const err =
            session && !session.ok ? session.error : `Session failed (${sessionRes.status})`;
          term.writeln(`\r\n\x1b[31m${err}\x1b[0m`);
          setConnection("error");
          setErrorText(err ?? "Could not start terminal session");
          return;
        }

        const ws = new WebSocket(
          `${session.wsUrl}?token=${encodeURIComponent(session.token)}`,
        );
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          setConnection("open");
          setErrorText(null);
          fit.fit();
          sendResize();
          term.focus();
        };

        ws.onmessage = (event) => {
          if (typeof event.data === "string") return;
          term.write(new Uint8Array(event.data as ArrayBuffer));
        };

        ws.onerror = () => {
          if (cancelled) return;
          setConnection("error");
          setErrorText("WebSocket connection failed");
        };

        ws.onclose = () => {
          if (cancelled) return;
          setConnection("closed");
          setErrorText(null);
        };

        dataDisposableRef.current = term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });

        const ro = new ResizeObserver(() => {
          fit.fit();
          sendResize();
        });
        if (hostRef.current) {
          ro.observe(hostRef.current);
          resizeObserverRef.current = ro;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load terminal";
        setConnection("error");
        setErrorText(msg);
      }
    })();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [disconnect, projectId, running, sendResize]);

  React.useEffect(() => {
    if (!visible) return;
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    requestAnimationFrame(() => {
      fit.fit();
      sendResize();
      term.focus();
    });
  }, [visible, sendResize]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-zinc-950",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-zinc-400">
        <TerminalSquare className="size-3.5 shrink-0" aria-hidden />
        <span>Container terminal</span>
        <span className="truncate text-zinc-500">{headerStatus}</span>
        {connection === "connecting" ? (
          <Loader2 className="ms-auto size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : null}
      </div>

      {inactiveMessage ? (
        <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-500">
          {inactiveMessage}
        </p>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div ref={hostRef} className="absolute inset-0 overflow-hidden p-1" />
          {errorText && connection !== "open" ? (
            <p className="absolute bottom-2 left-2 right-2 rounded-md bg-red-950/90 px-2 py-1 text-xs text-red-300">
              {errorText}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
