"use client";

import * as React from "react";
import { Globe, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const DEFAULT_PREVIEW_URL = "about:blank";

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
  const [urlInput, setUrlInput] = React.useState(DEFAULT_PREVIEW_URL);
  const [iframeSrc, setIframeSrc] = React.useState(DEFAULT_PREVIEW_URL);

  React.useEffect(() => {
    if (!previewUrl) return;
    setUrlInput(previewUrl);
    setIframeSrc(previewUrl);
  }, [previewUrl]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const applyUrl = React.useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setIframeSrc(DEFAULT_PREVIEW_URL);
      return;
    }
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    setIframeSrc(withProtocol);
  }, [urlInput]);

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
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="https://…"
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
