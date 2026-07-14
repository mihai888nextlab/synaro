import type { GetServerSideProps } from "next";

import { consumeAuthToken } from "@/lib/auth/tokens";
import { markEmailVerified } from "@/lib/auth/verification";
import { authOptions } from "@/lib/next-auth-options";
import { verifyEmailPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";
import { getServerSession } from "next-auth/next";

import { AuthEmailStatusPage } from "@/components/ui/auth/auth-email-status-page";

type VerifyEmailPageProps = {
  seo: PageSeoProps;
  status: "success" | "invalid";
};

export default function VerifyEmailPage({ status }: VerifyEmailPageProps) {
  return <AuthEmailStatusPage variant={status === "success" ? "verified" : "verifyInvalid"} />;
}

export const getServerSideProps: GetServerSideProps<VerifyEmailPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const raw = ctx.query.token;
  const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (!token) {
    return { props: { seo: verifyEmailPageSeo(), status: "invalid" } };
  }

  const email = await consumeAuthToken(token, "verify");
  if (!email) {
    return { props: { seo: verifyEmailPageSeo(), status: "invalid" } };
  }

  await markEmailVerified(email);
  return { props: { seo: verifyEmailPageSeo(), status: "success" } };
};
