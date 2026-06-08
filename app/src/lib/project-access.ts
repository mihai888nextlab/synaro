import type { Prisma } from "@prisma/client";

/** Projects the user owns or was added to as a collaborator. */
export function whereProjectVisibleToUser(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

export function whereProjectBySlugForUser(slug: string, userId: string): Prisma.ProjectWhereInput {
  return {
    slug,
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

export function whereProjectByIdForUser(projectId: string, userId: string): Prisma.ProjectWhereInput {
  return {
    id: projectId,
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}
