import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";

export async function requireAuth(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<Record<string, never>>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return { props: {} };
}

export async function redirectIfAuthed(
  ctx: GetServerSidePropsContext,
  destination = "/dashboard",
): Promise<GetServerSidePropsResult<Record<string, never>>> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  return { props: {} };
}

