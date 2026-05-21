import type { GetStaticProps } from "next";

import { DocumentationView } from "@/components/ui/documentation-view";
import { DEFAULT_DOC_SLUG, getDocPage, type DocPage } from "@/lib/documentation";

type Props = { page: DocPage };

export default function DocumentationIndexPage({ page }: Props) {
  return <DocumentationView page={page} />;
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const page = getDocPage(DEFAULT_DOC_SLUG);
  if (!page) return { notFound: true };
  return { props: { page } };
};
