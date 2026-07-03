import type { GetStaticProps } from "next";

import { DocumentationView } from "@/components/ui/documentation-view";
import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import { docPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type Props = {
  slug: string;
  seo: PageSeoProps;
};

export default function DocumentationIndexPage({ slug }: Props) {
  return <DocumentationView slug={slug} />;
}

export const getStaticProps: GetStaticProps<Props> = async () => ({
  props: {
    slug: DEFAULT_DOC_SLUG,
    seo: docPageSeo(DEFAULT_DOC_SLUG),
  },
});
