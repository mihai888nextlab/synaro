"use client";

import * as React from "react";
import { Globe, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const DEFAULT_PREVIEW_URL = "about:blank";

/** Extracts the /api/preview/{envId} prefix from a previewUrl, or null if not a proxy URL. */
function extractProxyPrefix(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^(\/api\/preview\/[^/?#]+)/);
  return m ? m[1] : null;
}

/** Converts an iframe src back to a display path ("/test") by stripping the proxy prefix. */
function srcToDisplayPath(src: string, proxyPrefix: string | null): string {
  if (!proxyPrefix || !src.startsWith(proxyPrefix)) return src;
  return src.slice(proxyPrefix.length) || "/";
}

/** Resolves a user-typed string to an iframe src, using the proxy prefix for bare paths. */
function resolveInputToSrc(input: string, proxyPrefix: string | null): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_PREVIEW_URL;
  if (trimmed.includes("://")) return trimmed; // external URL — use as-is
  // Treat as an app path (e.g. "/test", "test", "/api/users")
  if (proxyPrefix) {
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${proxyPrefix}${path}`;
  }
  return `https://${trimmed}`;
}

export function ProjectIframePreview({
  className,
  title = "Preview",
  chromeless = false,
  previewUrl,
}: {
  className?: string;
  title?: string;
  chromeless?: boolean;
  /** When set by parent (e.g. after Run), navigate the iframe here automatically. */
  previewUrl?: string | null;
}) {
  const proxyPrefix = extractProxyPrefix(previewUrl);

  const [urlInput, setUrlInput] = React.useState("/");
  const [iframeSrc, setIframeSrc] = React.useState(DEFAULT_PREVIEW_URL);

  React.useEffect(() => {
    if (!previewUrl) return;
    setUrlInput("/");
    setIframeSrc(previewUrl);
  }, [previewUrl]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const applyUrl = React.useCallback(() => {
    const src = resolveInputToSrc(urlInput, proxyPrefix);
    setIframeSrc(src);
    // Keep the display path in sync
    const display = srcToDisplayPath(src, proxyPrefix);
    setUrlInput(display);
  }, [urlInput, proxyPrefix]);

  // Sync the URL bar when the iframe navigates internally (e.g. clicking links in the app).
  const handleIframeLoad = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !proxyPrefix) return;
    try {
      const { pathname, search, hash } = iframe.contentWindow.location;
      if (pathname.startsWith(proxyPrefix)) {
        setUrlInput((pathname.slice(proxyPrefix.length) || "/") + search + hash);
      }
    } catch {
      // Blocked by cross-origin policy — ignore
    }
  }, [proxyPrefix]);

  const refresh = React.useCallback(() => {
    const el = iframeRef.current;
    if (!el) return;
    el.src = iframeSrc;
  }, [iframeSrc]);

  if (chromeless) {
    return (
      <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background", className)}>
        {iframeSrc === "about:blank" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">Preview</p>
            <p className="max-w-sm text-xs text-muted-foreground/80">
              Connect a preview URL from your project when this view is wired to the backend.
            </p>
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          title={title}
          src={iframeSrc}
          onLoad={handleIframeLoad}
          className={cn(
            "h-full min-h-0 w-full flex-1 bg-background",
            iframeSrc === "about:blank" && "opacity-0",
          )}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl bg-background/40",
        className,
      )}
    >
      <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate text-xs font-medium text-foreground">{title}</p>
        </div>
        <div className="flex min-w-0 w-full flex-1 items-center gap-1.5 sm:max-w-md sm:min-w-[200px] sm:gap-2">
          <Input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="/path or https://…"
            className="h-8 text-xs"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl bg-muted px-3 text-xs font-medium text-foreground transition hover:bg-muted/80"
          >
            Go
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
            aria-label="Refresh preview"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-muted/30">
        {iframeSrc === "about:blank" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground">No preview URL yet</p>
            <p className="max-w-sm text-xs text-muted-foreground/80">
              Enter a URL above and press Go. Many sites block embedding in iframes (X-Frame-Options); use a
              page you control or a known embed-friendly URL for testing.
            </p>
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          title={title}
          src={iframeSrc}
          onLoad={handleIframeLoad}
          className={cn(
            "h-full min-h-0 w-full bg-background",
            iframeSrc === "about:blank" && "opacity-0",
          )}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
