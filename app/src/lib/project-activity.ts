import { prisma } from "@/lib/prisma";

/** Fire-and-forget — stamps lastActivityAt on the project without blocking the request. */
export function touchProjectActivity(projectId: string): void {
  void prisma.project
    .update({ where: { id: projectId }, data: { lastActivityAt: new Date() } })
    .catch(() => {});
}
