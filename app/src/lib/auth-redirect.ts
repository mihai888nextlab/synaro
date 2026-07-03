import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";

export async function requireAuth<P extends Record<string, unknown> = Record<string, never>>(
  ctx: GetServerSidePropsContext,
  props?: P,
): Promise<GetServerSidePropsResult<P>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
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

