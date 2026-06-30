import type { EnvironmentStatus } from "@prisma/client";

import { recordDockerActivityLog } from "@/lib/activity-log";
import {
  fetchEnvironmentsForProject,
  parseRemoteStatus,
  pickActiveRuntimeEnvironment,
  remoteCreateEnvironment,
  remoteDestroyEnvironment,
  remoteStartEnvironment,
  remoteStopEnvironment,
  type RemoteEnvironment,
} from "@/lib/environment-service-api";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

function previewHostBase(): string {
  const fromEnv = process.env.SYNARO_PREVIEW_HOST?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost";
}

function projectUpdateFromRemoteEnv(env: RemoteEnvironment): {
  environmentStatus: EnvironmentStatus;
  repositoryLocation: string | null;
} {
  const st = parseRemoteStatus(env.status) ?? "ERROR";
  if (st !== "RUNNING") return { environmentStatus: st, repositoryLocation: null };

  const port = typeof env.port === "number" ? env.port : null;
  const repositoryLocation =
    env.publicUrl ?? (port != null ? `${previewHostBase()}:${port}` : null);
  return { environmentStatus: st, repositoryLocation };
}

export type ProjectEnvironmentResult = {
  environment_status: EnvironmentStatus;
  preview_url: string | null;
  repository_location: string | null;
};

export async function controlProjectEnvironment(
  projectId: string,
  actorUserId: string,
  action: "start" | "stop",
): Promise<ProjectEnvironmentResult> {
  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, actorUserId),
    select: { id: true, userId: true, cloneRepositoryUrl: true, slug: true },
  });
  if (!project) throw new Error("Project not found");

  const createOpts = {
    ...(project.cloneRepositoryUrl != null && project.cloneRepositoryUrl.length > 0
      ? {
          gitRemoteUrl: project.cloneRepositoryUrl,
          gitAccessToken: (await getGithubAccessTokenForUser(project.userId)) ?? undefined,
        }
      : {}),
    projectSlug: project.slug,
  };

  let env: RemoteEnvironment | null = null;

  if (action === "stop") {
    const rows = await fetchEnvironmentsForProject(projectId);
    const active = pickActiveRuntimeEnvironment(rows);
    if (!rows.length) {
      await prisma.project.update({
        where: { id: projectId },
        data: { environmentStatus: "INACTIVE", repositoryLocation: null },
      });
      await recordDockerActivityLog({
        userId: actorUserId,
        projectId,
        kind: "stop",
        environmentStatus: "INACTIVE",
      });
      return {
        environment_status: "INACTIVE",
        preview_url: null,
        repository_location: null,
      };
    }
    if (!active) {
      const latest = rows[0]!;
      const patch = projectUpdateFromRemoteEnv(latest);
      await prisma.project.update({ where: { id: projectId }, data: patch });
      await recordDockerActivityLog({
        userId: actorUserId,
        projectId,
        kind: "stop",
        environmentStatus: patch.environmentStatus,
      });
      return {
        environment_status: patch.environmentStatus,
        preview_url: latest.publicUrl ?? null,
        repository_location: patch.repositoryLocation,
      };
    }
    if (active.status === "RUNNING" || active.status === "PROVISIONING") {
      env = await remoteStopEnvironment(active.id);
    }
  } else {
    const rows = await fetchEnvironmentsForProject(projectId);
    const active = pickActiveRuntimeEnvironment(rows);

    if (!active) {
      const stopped = rows.find((r) => r.status === "STOPPED" && r.containerId);
      if (stopped) {
        env = await remoteStartEnvironment(stopped.id);
      } else if (!rows.length) {
        env = await remoteCreateEnvironment(projectId, "node:20-alpine", createOpts);
      } else {
        const head = rows[0]!;
        await remoteDestroyEnvironment(head.id);
        const image =
          typeof head.image === "string" && head.image.length > 0 ? head.image : "node:20-alpine";
        env = await remoteCreateEnvironment(projectId, image, createOpts);
      }
    } else if (active.status === "RUNNING") {
      const patch = projectUpdateFromRemoteEnv(active);
      await prisma.project.update({ where: { id: projectId }, data: patch });
      return {
        environment_status: patch.environmentStatus,
        preview_url: active.publicUrl ?? null,
        repository_location: patch.repositoryLocation,
      };
    } else if (active.status === "PROVISIONING") {
      throw new Error("Environment is already starting. Wait for it to finish.");
    } else {
      throw new Error(`Unexpected environment status: ${active.status}`);
    }
  }

  if (!env) throw new Error("Unexpected empty environment result");

  const patch = projectUpdateFromRemoteEnv(env);
  await prisma.project.update({ where: { id: projectId }, data: patch });
  await recordDockerActivityLog({
    userId: actorUserId,
    projectId,
    kind: action,
    environmentStatus: patch.environmentStatus,
  });

  return {
    environment_status: patch.environmentStatus,
    preview_url: env.publicUrl ?? null,
    repository_location: patch.repositoryLocation,
  };
}
