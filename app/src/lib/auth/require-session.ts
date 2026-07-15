import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { isUserEmailVerified } from "@/lib/auth/verification";

export async function requireSession(
  ctx: GetServerSidePropsContext,
): Promise<{ userId: string } | GetServerSidePropsResult<never>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const verified = await isUserEmailVerified(session.user.id);
  if (!verified) {
    return { redirect: { destination: "/login?error=EMAIL_NOT_VERIFIED", permanent: false } };
  }

  return { userId: session.user.id };
}
