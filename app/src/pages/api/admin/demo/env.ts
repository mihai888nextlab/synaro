import type { NextApiRequest, NextApiResponse } from "next";
import type { EnvironmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteStartEnvironment,
  remoteStopEnvironment,
} from "@/lib/environment-service-api";
import { provisionProjectEnvironment } from "@/lib/provision-project-environment";
import { resolveProjectDockerImage } from "@/lib/project-docker-images";

function coerce(s: string): EnvironmentStatus {
  const allowed: EnvironmentStatus[] = ["INACTIVE", "PROVISIONING", "RUNNING", "STOPPED", "ERROR"];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : "ERROR";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const body = req.body as { projectId?: string; action?: "start" | "stop" };
  if (!body.projectId || (body.action !== "start" && body.action !== "stop")) {
    return res.status(400).json({ error: "projectId and action (start|stop) are required" });
  }

  const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } });
  if (!project) return res.status(404).json({ error: "Project not found" });

  try {
    let status: EnvironmentStatus = "INACTIVE";
    const envs = await fetchEnvironmentsForProject(body.projectId).catch(() => []);

    if (body.action === "start") {
      const active = pickActiveRuntimeEnvironment(envs);
      if (active) {
        status = coerce(active.status);
      } else {
        const stopped = envs.find((e) => e.status === "STOPPED");
        if (stopped) {
          const r = await remoteStartEnvironment(stopped.id);
          status = coerce(r.status);
        } else {
          // First start: provision an env — it mounts the pre-filled workspace volume (same files).
          const r = await provisionProjectEnvironment(body.projectId, resolveProjectDockerImage("automatic"));
          status = coerce(r.status);
        }
      }
    } else {
      const running = envs.filter((e) => e.status === "RUNNING" || e.status === "PROVISIONING");
      for (const e of running) await remoteStopEnvironment(e.id).catch(() => {});
      status = running.length > 0 ? "STOPPED" : "INACTIVE";
    }

    await prisma.project.update({ where: { id: body.projectId }, data: { environmentStatus: status } });
    return res.json({ status });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
