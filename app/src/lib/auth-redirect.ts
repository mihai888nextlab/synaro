import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { isUserEmailVerified } from "@/lib/auth/verification";

export async function requireAuth<P extends Record<string, unknown> = Record<string, never>>(
  ctx: GetServerSidePropsContext,
  props?: P,
): Promise<GetServerSidePropsResult<P>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const verified = await isUserEmailVerified(session.user.id);
  if (!verified) {
    return {
      redirect: {
        destination: "/login?error=EMAIL_NOT_VERIFIED",
        permanent: false,
      },
    };
  }

  return { props: (props ?? {}) as P };
}

export async function redirectIfAuthed<P extends Record<string, unknown> = Record<string, never>>(
  ctx: GetServerSidePropsContext,
  destination = "/dashboard",
  props?: P,
): Promise<GetServerSidePropsResult<P>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  // Only treat a FULLY valid session as "authed". A blocked session (unverified
  // email or bumped sessionVersion) comes back truthy but with no `user` — using
  // `if (session)` here would bounce it to /dashboard, which requires `user.id`
  // and bounces it right back to /login → infinite redirect loop.
  if (session?.user?.id) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  return { props: (props ?? {}) as P };
}

