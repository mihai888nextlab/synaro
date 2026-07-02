import type { Locale } from "@/i18n/config";

import * as en from "./en";
import * as ro from "./ro";
import {
  DEFAULT_DOC_SLUG,
  type DocBlock,
  type DocNavGroup,
  type DocPage,
} from "./types";

export { DEFAULT_DOC_SLUG, type DocBlock, type DocNavGroup, type DocPage } from "./types";

const PACKS = { en, ro } as const;

function getPack(locale: Locale) {
  return PACKS[locale] ?? PACKS.en;
}

export function getDocNav(locale: Locale): DocNavGroup[] {
  return getPack(locale).DOC_NAV;
}

export function getDocPage(slug: string | undefined, locale: Locale): DocPage | null {
  const key = slug && slug.length > 0 ? slug : DEFAULT_DOC_SLUG;
  return getPack(locale).DOC_PAGES[key] ?? null;
}

export function getDocSlugs(): string[] {
  return Object.keys(en.DOC_PAGES);
}

export function docHref(slug: string): string {
  return slug === DEFAULT_DOC_SLUG ? "/documentation" : `/documentation/${slug}`;
}

export function getDocNavOrder(locale: Locale) {
  return getDocNav(locale).flatMap((group) => group.items);
}

export function getDocAdjacent(
  slug: string,
  locale: Locale,
): {
  prev: { slug: string; label: string } | null;
  next: { slug: string; label: string } | null;
} {
  const order = getDocNavOrder(locale);
  const index = order.findIndex((item) => item.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? order[index - 1]! : null,
    next: index < order.length - 1 ? order[index + 1]! : null,
  };
}

export type DocSearchResult = {
  slug: string;
  label: string;
  group: string;
};

function docBlockToSearchText(block: DocBlock): string {
  switch (block.type) {
    case "p":
    case "h2":
    case "h3":
      return block.text;
    case "ul":
    case "ol":
      return block.items.join(" ");
    case "code":
      return [block.title, block.code].filter(Boolean).join(" ");
    case "table":
      return [...block.headers, ...block.rows.flat()].join(" ");
    case "callout":
      return [block.title, block.text].filter(Boolean).join(" ");
    default:
      return "";
  }
}

function docPageSearchText(slug: string, label: string, locale: Locale): string {
  const page = getDocPage(slug, locale);
  if (!page) return label;
  return [label, page.title, page.description, ...page.blocks.map(docBlockToSearchText)].join(" ");
}

export function searchDocumentation(query: string, locale: Locale): DocSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: DocSearchResult[] = [];
  for (const group of getDocNav(locale)) {
    for (const item of group.items) {
      if (docPageSearchText(item.slug, item.label, locale).toLowerCase().includes(normalized)) {
        results.push({ slug: item.slug, label: item.label, group: group.title });
      }
    }
  }
  return results;
}

export function filterDocNav(query: string, locale: Locale): DocNavGroup[] {
  const normalized = query.trim().toLowerCase();
  const nav = getDocNav(locale);
  if (!normalized) return nav;

  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        docPageSearchText(item.slug, item.label, locale).toLowerCase().includes(normalized),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
