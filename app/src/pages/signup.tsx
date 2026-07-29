import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { SignupPageClient } from "@/components/ui/signup-page-client";
import { getSafeCallbackUrl, redirectIfAuthed } from "@/lib/auth-redirect";
import { signupPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function SignupPage() {
  const router = useRouter();
  const callbackUrl = getSafeCallbackUrl(router.query.callbackUrl);
  return <SignupPageClient callbackUrl={callbackUrl} />;
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) => {
  const callbackUrl = getSafeCallbackUrl(ctx.query.callbackUrl);
  return redirectIfAuthed(ctx, callbackUrl, { seo: signupPageSeo() });
};
