import type { GetServerSideProps } from "next";

import { SignupPageClient } from "@/components/ui/signup-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { signupPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function SignupPage() {
  return <SignupPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: signupPageSeo() });
