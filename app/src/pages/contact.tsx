import type { GetServerSideProps } from "next";

import { ContactPageClient } from "@/components/ui/contact/contact-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { contactPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function ContactPage() {
  return <ContactPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: contactPageSeo() });
