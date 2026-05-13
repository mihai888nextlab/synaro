import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";

import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import { ProjectsPageClient } from "@/components/ui/projects-page-client";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { projectRowToCardModel } from "@/lib/map-project-to-card";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default function ProjectsPage({ initialProjects }: { initialProjects: SynaroProjectCardModel[] }) {
  return <ProjectsPageClient initialProjects={initialProjects} />;
}

export const getServerSideProps: GetServerSideProps<{ initialProjects: SynaroProjectCardModel[] }> = async (
  ctx,
) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const rows = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  const live = await latestEnvironmentSummariesByProjectId(rows.map((r) => r.id));
  const initialProjects = rows.map((row, i) => {
    const s = live[row.id];
    const st = s ? parseEnvironmentStatusFromService(s.status) : null;
    const merged = st ? { ...row, environmentStatus: st } : row;
    return projectRowToCardModel(merged, i);
  });

  return { props: { initialProjects } };
};
