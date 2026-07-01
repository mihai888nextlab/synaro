"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Check, ChevronLeft, ChevronRight, Copy, Menu, Search, X } from "lucide-react";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import {
  DOC_NAV,
  type DocBlock,
  type DocPage,
  docHref,
  filterDocNav,
  getDocAdjacent,
} from "@/lib/documentation";
import { cn } from "@/lib/utils";

function DocCodeExample({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        {title ? <p className="text-xs font-medium text-zinc-500">{title}</p> : <span aria-hidden />}
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200 sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DocBlockView({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-[0.9375rem] leading-7 text-zinc-300">{block.text}</p>;
    case "h2":
      return (
        <h2 className="scroll-mt-24 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="scroll-mt-24 text-lg font-semibold tracking-tight text-zinc-100">{block.text}</h3>
      );
    case "ul":
      return (
        <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-7 text-zinc-300">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-2 pl-5 text-[0.9375rem] leading-7 text-zinc-300">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "code":
      return <DocCodeExample code={block.code} title={block.title} />;
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {block.headers.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-medium uppercase tracking-[0.06em] text-zinc-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 text-zinc-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "callout":
      return (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm leading-relaxed",
            block.variant === "tip"
              ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100/90"
              : "border-sky-500/30 bg-sky-500/[0.06] text-sky-100/90",
          )}
        >
          {block.title ? <p className="mb-1 font-medium text-white">{block.title}</p> : null}
          <p className="text-zinc-300">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

function DocsSidebarSearch({
  query,
  onQueryChange,
  inputId,
  onKeyDown,
  activeDescendantId,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  inputId: string;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  activeDescendantId?: string;
}) {
  return (
    <div className="relative mb-4 px-3">
      <Search
        className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={query.length > 0}
        aria-controls="docs-sidebar-results"
        aria-autocomplete="list"
        aria-activedescendant={activeDescendantId}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search docs…"
        className="h-9 w-full rounded-lg border border-white/10 bg-zinc-950/80 py-2 pl-9 pr-8 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
        aria-label="Search documentation"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          className="absolute right-5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function DocsSidebar({
  activeSlug,
  onNavigate,
  className,
  searchQuery,
  onSearchQueryChange,
  searchInputId = "docs-sidebar-search",
}: {
  activeSlug: string;
  onNavigate?: () => void;
  className?: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchInputId?: string;
}) {
  const router = useRouter();
  const filteredNav = React.useMemo(() => filterDocNav(searchQuery), [searchQuery]);
  const flatItems = React.useMemo(() => filteredNav.flatMap((group) => group.items), [filteredNav]);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const itemRefs = React.useRef<Map<string, HTMLAnchorElement>>(new Map());
  const hasResults = filteredNav.length > 0;

  React.useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  React.useEffect(() => {
    if (highlightedIndex < 0) return;
    const slug = flatItems[highlightedIndex]?.slug;
    if (!slug) return;
    itemRefs.current.get(slug)?.scrollIntoView({ block: "nearest" });
  }, [flatItems, highlightedIndex]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const keyboardNavEnabled = searchQuery.trim().length > 0 && flatItems.length > 0;
    if (!keyboardNavEnabled && event.key !== "Escape") return;

    if (event.key === "ArrowDown") {
      if (!keyboardNavEnabled) return;
      event.preventDefault();
      setHighlightedIndex((index) => (index < flatItems.length - 1 ? index + 1 : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      if (!keyboardNavEnabled) return;
      event.preventDefault();
      setHighlightedIndex((index) => (index > 0 ? index - 1 : flatItems.length - 1));
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      const item = flatItems[highlightedIndex];
      if (!item) return;
      void router.push(docHref(item.slug));
      onNavigate?.();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (searchQuery) {
        onSearchQueryChange("");
      } else {
        setHighlightedIndex(-1);
        event.currentTarget.blur();
      }
    }
  };

  const highlightedSlug = highlightedIndex >= 0 ? flatItems[highlightedIndex]?.slug : undefined;

  return (
    <nav className={cn("flex flex-col", className)} aria-label="Documentation">
      <DocsSidebarSearch
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        inputId={searchInputId}
        onKeyDown={handleSearchKeyDown}
        activeDescendantId={highlightedSlug ? `docs-nav-${highlightedSlug}` : undefined}
      />

      {hasResults ? (
        <div id="docs-sidebar-results" className="flex flex-col gap-6" role="listbox">
          {filteredNav.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-zinc-500">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.slug === activeSlug;
                  const highlighted = item.slug === highlightedSlug;
                  return (
                    <li key={item.slug} role="presentation">
                      <Link
                        id={`docs-nav-${item.slug}`}
                        href={docHref(item.slug)}
                        onClick={onNavigate}
                        ref={(node) => {
                          if (node) itemRefs.current.set(item.slug, node);
                          else itemRefs.current.delete(item.slug);
                        }}
                        role="option"
                        aria-selected={highlighted}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm transition",
                          highlighted
                            ? "bg-white/15 font-medium text-white ring-1 ring-white/20"
                            : active
                              ? "bg-white/10 font-medium text-white"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : searchQuery.trim() ? (
        <p className="px-3 text-sm text-zinc-500">No pages match your search.</p>
      ) : null}
    </nav>
  );
}

const docNavLinkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/20 hover:text-white";

export function DocumentationView({ page }: { page: DocPage }) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [sidebarSearch, setSidebarSearch] = React.useState("");
  const { prev, next } = getDocAdjacent(page.slug);

  React.useEffect(() => {
    setMobileNavOpen(false);
    setSidebarSearch("");
  }, [router.asPath]);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-black text-white">
      <PageBackgroundPattern className="opacity-40" />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <SiteHeader />
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-4 sm:px-6 lg:flex-row lg:px-8">
          <aside className="hidden min-h-0 w-56 shrink-0 overflow-y-auto border-r border-white/10 lg:block xl:w-60">
            <div className="py-6 pr-4">
              <DocsSidebar
                activeSlug={page.slug}
                searchQuery={sidebarSearch}
                onSearchQueryChange={setSidebarSearch}
              />
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 py-4 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 text-zinc-300"
                aria-label="Open documentation menu"
              >
                <Menu className="size-4" />
              </button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Jump to page</span>
                <select
                  className="h-9 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 text-sm text-zinc-200"
                  value={page.slug}
                  onChange={(e) => {
                    const href = docHref(e.target.value);
                    void router.push(href);
                  }}
                >
                  {DOC_NAV.flatMap((g) => g.items).map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <article className="min-h-0 flex-1 overflow-y-auto">
              <div className="py-8 lg:py-10 lg:pl-2 xl:pl-6">
                <div className="mb-8 border-b border-white/10 pb-8">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{page.title}</h1>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">{page.description}</p>
                </div>

                <div className="flex max-w-3xl flex-col gap-6">
                  {page.blocks.map((block, i) => (
                    <DocBlockView key={`${block.type}-${i}`} block={block} />
                  ))}
                </div>

                {(prev || next) && (
                  <nav
                    className={cn(
                      "mt-12 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8 text-sm",
                      prev && next ? "justify-between" : next ? "justify-end" : "justify-start",
                    )}
                    aria-label="Documentation pagination"
                  >
                    {prev ? (
                      <Link href={docHref(prev.slug)} className={docNavLinkClass}>
                        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
                        <span>{prev.label}</span>
                      </Link>
                    ) : null}
                    {next ? (
                      <Link href={docHref(next.slug)} className={docNavLinkClass}>
                        <span>{next.label}</span>
                        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                      </Link>
                    ) : null}
                  </nav>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col border-r border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium text-white">Documentation</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md text-zinc-400"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 pt-4">
              <DocsSidebar
                activeSlug={page.slug}
                onNavigate={() => setMobileNavOpen(false)}
                searchQuery={sidebarSearch}
                onSearchQueryChange={setSidebarSearch}
                searchInputId="docs-mobile-sidebar-search"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
