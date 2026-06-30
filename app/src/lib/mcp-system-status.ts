import type { EnvironmentStatus } from "@prisma/client";

import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteExecTerminal,
} from "@/lib/environment-service-api";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";

function environmentServiceBaseUrl(): string {
  return process.env.ENVIRONMENT_SERVICE_URL?.trim() || "http://localhost:3004";
}

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}

const PORT_CHECK_CMD =
  "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo SYNARO_READY || echo SYNARO_WAIT";

async function fetchServiceHealth(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, ...body };
  } catch (err) {
    return {
      ok: false,
      status: "unreachable",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getSynaroSystemStatus(opts?: {
  projectId?: string;
  userId?: string;
}): Promise<{
  platform: {
    app: { ok: boolean; database: string };
    environment_service: Record<string, unknown>;
    ai_service: Record<string, unknown>;
  };
  project?: {
    id: string;
    environment_status: EnvironmentStatus;
    run_ready: boolean;
    preview_url: string | null;
  };
}> {
  let appDb = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    appDb = "connected";
  } catch {
    appDb = "error";
  }

  const [environment_service, ai_service] = await Promise.all([
    fetchServiceHealth(`${environmentServiceBaseUrl()}/health`),
    fetchServiceHealth(`${aiServiceBaseUrl()}/health`),
  ]);

  const out: {
    platform: {
      app: { ok: boolean; database: string };
      environment_service: Record<string, unknown>;
      ai_service: Record<string, unknown>;
    };
    project?: {
      id: string;
      environment_status: EnvironmentStatus;
      run_ready: boolean;
      preview_url: string | null;
    };
  } = {
    platform: {
      app: { ok: appDb === "connected", database: appDb },
      environment_service,
      ai_service,
    },
  };

  if (!opts?.projectId) return out;

  const project = await prisma.project.findFirst({
    where: opts.userId
      ? whereProjectByIdForUser(opts.projectId, opts.userId)
      : { id: opts.projectId },
    select: { id: true, environmentStatus: true },
  });
  if (!project) return out;

  let runReady = false;
  let previewUrl: string | null = null;

  const envs = await fetchEnvironmentsForProject(project.id).catch(() => []);
  const env = pickActiveRuntimeEnvironment(envs);
  if (env) {
    previewUrl = env.publicUrl ?? (env.port ? `/api/preview/${env.id}` : null);
    if (env.status === "RUNNING") {
      try {
        const result = await remoteExecTerminal(env.id, PORT_CHECK_CMD);
        runReady = result.output.includes("SYNARO_READY");
      } catch {
        runReady = false;
      }
    }
  }

  out.project = {
    id: project.id,
    environment_status: project.environmentStatus,
    run_ready: runReady,
    preview_url: previewUrl,
  };
  return out;
}
