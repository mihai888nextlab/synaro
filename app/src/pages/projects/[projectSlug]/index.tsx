import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import type { SynaroProjectEnvironmentStatus } from "@/components/ui/project-cards-grid";
import { ProjectWorkspace } from "@/components/ui/project-workspace";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { requireSession } from "@/lib/auth/require-session";
import { whereProjectBySlugForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { projectWorkspaceSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type ProjectWorkspacePageProps = {
  projectId: string;
  initialEnvironmentStatus: SynaroProjectEnvironmentStatus;
  viewerIsOwner: boolean;
  seo: PageSeoProps;
};

export default function ProjectWorkspacePage({
  projectId,
  initialEnvironmentStatus,
  viewerIsOwner,
}: ProjectWorkspacePageProps) {
  const router = useRouter();
  const raw = router.query.projectSlug;
  const slug =
    typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";

  if (!router.isReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <ProjectWorkspace
      projectSlug={slug}
      projectId={projectId}
      initialEnvironmentStatus={initialEnvironmentStatus}
      canManageInvites={viewerIsOwner}
    />
  );
}

export const getServerSideProps: GetServerSideProps<ProjectWorkspacePageProps> = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) {
    return { notFound: true };
  }

  const project = await prisma.project.findFirst({
    where: whereProjectBySlugForUser(slug, auth.userId),
    select: {
      id: true,
      name: true,
      description: true,
      slug: true,
      environmentStatus: true,
      userId: true,
      cloneRepositoryUrl: true,
    },
  });
  if (!project) {
    return { notFound: true };
  }

  const live = await latestEnvironmentSummariesByProjectId([project.id]);
  const s = live[project.id];
  const st = s ? parseEnvironmentStatusFromService(s.status) : null;
  const environmentStatus = (st ?? project.environmentStatus) as SynaroProjectEnvironmentStatus;

  return {
    props: {
      projectId: project.id,
      initialEnvironmentStatus: environmentStatus,
      viewerIsOwner: project.userId === auth.userId,
      seo: projectWorkspaceSeo(project.slug, project.name, project.description),
    },
  };
};
