import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import { ProjectInviteJoinClient } from "@/components/ui/project-invite-join-client";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type InvitePageProps = {
  token: string;
  projectName: string;
  projectSlug: string;
};

export default function ProjectInvitePage(props: InvitePageProps) {
  return <ProjectInviteJoinClient {...props} />;
}

export const getServerSideProps: GetServerSideProps<InvitePageProps> = async (ctx) => {
  const raw = ctx.params?.token;
  const token = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!token) {
    return { notFound: true };
  }

  const invite = await prisma.projectInvite.findFirst({
    where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { project: { select: { id: true, slug: true, userId: true } } },
  });
  if (!invite) {
    return { notFound: true };
  }

  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const uid = session?.user?.id;
  if (uid) {
    const p = invite.project;
    if (p.userId === uid) {
      return { redirect: { destination: `/projects/${encodeURIComponent(p.slug)}`, permanent: false } };
    }
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: p.id, userId: uid } },
      select: { id: true },
    });
    if (m) {
      return { redirect: { destination: `/projects/${encodeURIComponent(p.slug)}`, permanent: false } };
    }
  }

  const full = await prisma.project.findUnique({
    where: { id: invite.projectId },
    select: { name: true, slug: true },
  });
  if (!full) {
    return { notFound: true };
  }

  return {
    props: {
      token,
      projectName: full.name,
      projectSlug: full.slug,
    },
  };
};
