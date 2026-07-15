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
  if (session) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  return { props: (props ?? {}) as P };
}

