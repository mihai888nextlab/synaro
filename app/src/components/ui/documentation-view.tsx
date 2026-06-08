"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { MinimalFooter } from "@/components/ui/minimal-footer";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import {
  DOC_NAV,
  type DocBlock,
  type DocPage,
  docHref,
  getDocAdjacent,
} from "@/lib/documentation";
import { cn } from "@/lib/utils";

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
      return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
          {block.title ? (
            <p className="border-b border-white/10 px-4 py-2 text-xs font-medium text-zinc-500">{block.title}</p>
          ) : null}
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-zinc-200 sm:text-sm">
            <code>{block.code}</code>
          </pre>
        </div>
      );
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

function DocsSidebar({
  activeSlug,
  onNavigate,
  className,
}: {
  activeSlug: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-6", className)} aria-label="Documentation">
      {DOC_NAV.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.slug === activeSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={docHref(item.slug)}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm transition",
                      active
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
    </nav>
  );
}

const docNavLinkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/20 hover:text-white";

export function DocumentationView({ page }: { page: DocPage }) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { prev, next } = getDocAdjacent(page.slug);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [router.asPath]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <PageBackgroundPattern className="opacity-40" />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <SiteHeader />

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:flex-row lg:px-8">
          <aside className="hidden w-56 shrink-0 lg:block xl:w-60">
            <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 pr-4">
              <p className="mb-8 px-3 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                Documentation
              </p>
              <DocsSidebar activeSlug={page.slug} />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 py-4 lg:hidden">
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

            <article className="min-w-0 flex-1 py-8 lg:py-10 lg:pl-2 xl:pl-6">
              <div className="mb-8 border-b border-white/10 pb-8">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
                  Synaro docs
                </p>
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
            </article>
          </div>
        </div>

        <MinimalFooter />
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
            <div className="overflow-y-auto p-4 pt-6">
              <DocsSidebar activeSlug={page.slug} onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
