import type { GetServerSideProps } from "next";

import { ResetPasswordPageClient } from "@/components/ui/auth/reset-password-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { resetPasswordPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: resetPasswordPageSeo() });
