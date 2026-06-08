import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
} from "@/lib/environment-service-api";
import { applyDynamicApiNoCacheHeaders } from "@/lib/apply-dynamic-api-no-cache";
import { whereProjectByIdForUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";
import {
  createTerminalWsToken,
  environmentServiceTerminalWsUrl,
} from "@/lib/terminal-ws-token";
import { touchProjectActivity } from "@/lib/project-activity";

export type TerminalSessionResponse =
  | { ok: true; wsUrl: string; token: string }
  | { ok: false; error: string; reason?: "no_environment" | "not_active" };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TerminalSessionResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  applyDynamicApiNoCacheHeaders(res);

  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  if (!projectId) {
    res.status(400).json({ ok: false, error: "Invalid project id" });
    return;
  }

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true },
  });
  if (!project) {
    res.status(404).json({ ok: false, error: "Project not found" });
    return;
  }

  touchProjectActivity(projectId);

  try {
    const rows = await fetchEnvironmentsForProject(projectId);
    if (rows.length === 0) {
      res.status(409).json({
        ok: false,
        error: "Start the project container to open a terminal.",
        reason: "no_environment",
      });
      return;
    }

    const active = pickActiveRuntimeEnvironment(rows);
    if (!active?.id || active.status !== "RUNNING") {
      res.status(409).json({
        ok: false,
        error: "Container must be running to open a terminal.",
        reason: "not_active",
      });
      return;
    }

    const token = createTerminalWsToken({
      environmentId: active.id,
      projectId,
      userId: session.user.id,
    });

    res.status(200).json({
      ok: true,
      wsUrl: environmentServiceTerminalWsUrl(active.id),
      token,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
}
