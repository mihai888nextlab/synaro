import type { GetServerSideProps } from "next";

import { AboutPageClient } from "@/components/ui/about/about-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { aboutPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function AboutPage() {
  return <AboutPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: aboutPageSeo() });
