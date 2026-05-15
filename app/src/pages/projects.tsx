import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import { ProjectsPageClient } from "@/components/ui/projects-page-client";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";
import { getUserProjectCardsWithRows } from "@/lib/user-project-cards";

export default function ProjectsPage({
  initialProjects,
  linkedGithub,
}: {
  initialProjects: SynaroProjectCardModel[];
  linkedGithub: boolean;
}) {
  return <ProjectsPageClient initialProjects={initialProjects} linkedGithub={linkedGithub} />;
}

export const getServerSideProps: GetServerSideProps<{
  initialProjects: SynaroProjectCardModel[];
  linkedGithub: boolean;
}> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accounts: { select: { provider: true } } },
  });
  const providerSet = new Set(user?.accounts.map((a) => a.provider) ?? []);
  const linkedGithub = providerSet.has("github");

  const { cards: initialProjects } = await getUserProjectCardsWithRows(session.user.id);

  return { props: { initialProjects, linkedGithub } };
};
