import type { GetStaticPaths, GetStaticProps } from "next";

import { DocumentationView } from "@/components/ui/documentation-view";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { DEFAULT_DOC_SLUG, getDocPage, getDocSlugs } from "@/lib/documentation";

type Props = { slug: string };

export default function DocumentationSlugPage({ slug }: Props) {
  return <DocumentationView slug={slug} />;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getDocSlugs().filter((s) => s !== DEFAULT_DOC_SLUG);
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const raw = ctx.params?.slug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const page = getDocPage(slug, DEFAULT_LOCALE);
  if (!page) return { notFound: true };
  return { props: { slug: page.slug } };
};
