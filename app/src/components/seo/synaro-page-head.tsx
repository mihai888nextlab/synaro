import Head from "next/head";

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  absoluteUrl,
  pageTitle,
  siteUrl,
} from "@/lib/seo/site-metadata";
import { type OgType, buildOgImageUrl } from "@/lib/seo/og-url";

export type SynaroPageHeadProps = {
  /** Page-specific title segment (without · Synaro suffix). */
  title?: string;
  description?: string;
  /** Path for canonical + og:url, e.g. `/pricing`. */
  path?: string;
  ogType?: OgType;
  ogParams?: Record<string, string | undefined>;
  /** When true, adds robots noindex (auth/settings pages). */
  noIndex?: boolean;
};

export function SynaroPageHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  ogType = "site",
  ogParams,
  noIndex = false,
}: SynaroPageHeadProps) {
  const documentTitle = pageTitle(title);
  const canonicalPath = path.split("?")[0] || "/";
  const canonical = absoluteUrl(canonicalPath);
  const ogImage = buildOgImageUrl(ogType, ogParams);
  const twitterTitle = title ? documentTitle : DEFAULT_TITLE;

  return (
    <Head>
      <title>{documentTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Synaro" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:locale:alternate" content="ro_RO" />
      <meta property="og:title" content={twitterTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${twitterTitle} — Synaro`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:domain" content={new URL(siteUrl()).hostname} />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={`${twitterTitle} — Synaro`} />

      <meta name="theme-color" content="#0a0a0a" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    </Head>
  );
}

/** Default OG image for the marketing site root. */
export function defaultOgImageUrl(): string {
  return buildOgImageUrl("site");
}

export { siteUrl };
