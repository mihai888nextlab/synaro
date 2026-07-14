import type { GetServerSideProps } from "next";

import { requireSession } from "@/lib/auth/require-session";
import { whereProjectBySlugForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

/** Legacy route — editor lives in the workspace File tree tab. */
export default function EditorRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) return { notFound: true };

  const project = await prisma.project.findFirst({
    where: whereProjectBySlugForUser(slug, auth.userId),
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
