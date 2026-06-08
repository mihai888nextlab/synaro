import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteStopEnvironment,
} from "@/lib/environment-service-api";
import { recordProjectActivityLog } from "@/lib/activity-log";

type AutoStopResult = { stopped: number; checked: number };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AutoStopResult | { error: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const idleMinutes = Math.max(1, Number(process.env.IDLE_STOP_MINUTES ?? "30") || 30);
  const threshold = new Date(Date.now() - idleMinutes * 60_000);

  // Find all RUNNING projects that haven't had activity since the threshold.
  // Null lastActivityAt means we've never tracked activity — treat as idle if the project
  // was last updated before the threshold too (safe fallback using updatedAt).
  const idleProjects = await prisma.project.findMany({
    where: {
      environmentStatus: "RUNNING",
      OR: [
        { lastActivityAt: { lt: threshold } },
        { lastActivityAt: null, updatedAt: { lt: threshold } },
      ],
    },
    select: { id: true, userId: true },
  });

  let stopped = 0;

  await Promise.allSettled(
    idleProjects.map(async (project) => {
      try {
        const envs = await fetchEnvironmentsForProject(project.id);
        const active = pickActiveRuntimeEnvironment(envs);
        if (!active?.id) return;

        await remoteStopEnvironment(active.id);

        await prisma.project.update({
          where: { id: project.id },
          data: { environmentStatus: "STOPPED" },
        });

        await recordProjectActivityLog({
          userId: project.userId,
          projectId: project.id,
          action: "Container stopped (idle)",
          status: "STOPPED",
        });

        stopped += 1;
      } catch {
        // Best-effort — a single failure shouldn't block the rest
      }
    }),
  );

  res.status(200).json({ stopped, checked: idleProjects.length });
}
