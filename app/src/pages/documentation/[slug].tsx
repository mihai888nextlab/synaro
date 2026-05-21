import type { GetStaticPaths, GetStaticProps } from "next";

import { DocumentationView } from "@/components/ui/documentation-view";
import { DEFAULT_DOC_SLUG, DOC_SLUGS, getDocPage, type DocPage } from "@/lib/documentation";

type Props = { page: DocPage };

export default function DocumentationSlugPage({ page }: Props) {
  return <DocumentationView page={page} />;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = DOC_SLUGS.filter((s) => s !== DEFAULT_DOC_SLUG);
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const raw = ctx.params?.slug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const page = getDocPage(slug);
  if (!page) return { notFound: true };
  return { props: { page } };
};
