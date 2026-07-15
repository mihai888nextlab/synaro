import type { GetServerSideProps } from "next";

import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import { ProjectsPageClient } from "@/components/ui/projects-page-client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
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
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { accounts: { select: { provider: true } } },
  });
  const providerSet = new Set(user?.accounts.map((a) => a.provider) ?? []);
  const linkedGithub = providerSet.has("github");

  const { cards: initialProjects } = await getUserProjectCardsWithRows(auth.userId);

  return { props: { initialProjects, linkedGithub } };
};
