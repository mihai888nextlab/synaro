import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useRouter } from "next/router";

import type { SynaroProjectEnvironmentStatus } from "@/components/ui/project-cards-grid";
import { ProjectWorkspace } from "@/components/ui/project-workspace";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { whereProjectBySlugForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

type ProjectWorkspacePageProps = {
  projectId: string;
  initialEnvironmentStatus: SynaroProjectEnvironmentStatus;
  viewerIsOwner: boolean;
  projectHasGitRemote: boolean;
};

export default function ProjectWorkspacePage({
  projectId,
  initialEnvironmentStatus,
  viewerIsOwner,
  projectHasGitRemote,
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
      projectHasGitRemote={projectHasGitRemote}
      initialEnvironmentStatus={initialEnvironmentStatus}
      canManageInvites={viewerIsOwner}
    />
  );
}

export const getServerSideProps: GetServerSideProps<ProjectWorkspacePageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) {
    return { notFound: true };
  }

  const project = await prisma.project.findFirst({
    where: whereProjectBySlugForUser(slug, session.user.id),
    select: { id: true, environmentStatus: true, userId: true, cloneRepositoryUrl: true },
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
      viewerIsOwner: project.userId === session.user.id,
      projectHasGitRemote: Boolean(project.cloneRepositoryUrl?.trim()),
    },
  };
};
