import type { GetServerSideProps } from "next";

import { FeaturesPageClient } from "@/components/ui/features/features-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { featuresPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function FeaturesPage() {
  return <FeaturesPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: featuresPageSeo() });
