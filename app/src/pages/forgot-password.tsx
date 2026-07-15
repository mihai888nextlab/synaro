import type { GetServerSideProps } from "next";

import { ForgotPasswordPageClient } from "@/components/ui/auth/forgot-password-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { forgotPasswordPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: forgotPasswordPageSeo() });
