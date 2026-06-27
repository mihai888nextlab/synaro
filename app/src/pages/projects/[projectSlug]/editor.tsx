import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import { whereProjectBySlugForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

/** Legacy route — editor lives in the workspace File tree tab. */
export default function EditorRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) return { notFound: true };

  const project = await prisma.project.findFirst({
    where: whereProjectBySlugForUser(slug, session.user.id),
    select: { id: true },
  });
  if (!project) return { notFound: true };

  return {
    redirect: {
      destination: `/projects/${encodeURIComponent(slug)}?tab=tree`,
      permanent: false,
    },
  };
};
