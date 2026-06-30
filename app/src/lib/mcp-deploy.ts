import type { EnvironmentStatus, Project } from "@prisma/client";

import { allocateUniqueProjectSlug } from "@/lib/allocate-project-slug";
import { getGithubAccessTokenForUser } from "@/lib/github-account";
import {
  defaultProjectNameFromGithubUrl,
  normalizeGithubRepoUrl,
} from "@/lib/github-repo-url";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteCreateEnvironment,
  remoteDestroyEnvironment,
  remoteExecTerminal,
  remoteStartEnvironment,
  remoteWorkspaceSelection,
  type RemoteEnvironment,
} from "@/lib/environment-service-api";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";
import {
  formatEnvironmentProvisionFailure,
  provisionProjectEnvironment,
} from "@/lib/provision-project-environment";
import { resolveProjectDockerImage } from "@/lib/project-docker-images";

const PORT_CHECK_CMD =
  "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo SYNARO_READY || echo SYNARO_WAIT";

type PackageJson = { scripts?: Record<string, string>; main?: string };

function detectRunCommand(pkg: PackageJson | null): string {
  if (!pkg) return "node index.js";
  const scripts = pkg.scripts ?? {};
  if (scripts.dev) return "npm run dev";
  if (scripts.start) return "npm start";
  if (scripts.serve) return "npm run serve";
  if (pkg.main) return `node ${pkg.main}`;
  return "node index.js";
}

function parseEnvStatus(s: string): EnvironmentStatus {
  const allowed: EnvironmentStatus[] = ["INACTIVE", "PROVISIONING", "RUNNING", "STOPPED", "ERROR"];
  return allowed.includes(s as EnvironmentStatus) ? (s as EnvironmentStatus) : "ERROR";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createProjectForUser(
  userId: string,
  input: {
    name?: string;
    description?: string;
    repositoryUrl?: string;
    dockerImage?: string;
  },
): Promise<{
  project: Project;
  environmentWarning?: string;
}> {
  const repositoryUrlRaw = input.repositoryUrl?.trim() ?? "";
  let cloneRepositoryUrl: string | null = null;
  if (repositoryUrlRaw) {
    cloneRepositoryUrl = normalizeGithubRepoUrl(repositoryUrlRaw);
    if (!cloneRepositoryUrl) {
      throw new Error("Invalid GitHub repository URL (use https://github.com/owner/repo).");
    }
  }

  let name = input.name?.trim() ?? "";
  if (!name && cloneRepositoryUrl) {
    name = defaultProjectNameFromGithubUrl(cloneRepositoryUrl);
  }
  const description = input.description?.trim().slice(0, 2000) ?? "";
  const image = resolveProjectDockerImage(input.dockerImage ?? "automatic");

  if (!name || name.length > 120) {
    throw new Error("Invalid project name");
  }

  const slug = await allocateUniqueProjectSlug(prisma, name);
  let project = await prisma.project.create({
    data: {
      slug,
      name,
      description: description || null,
      userId,
      environmentStatus: "PROVISIONING",
      cloneRepositoryUrl,
    },
  });

  try {
    const gitAccessToken = cloneRepositoryUrl ? await getGithubAccessTokenForUser(userId) : null;
    const env = await provisionProjectEnvironment(project.id, image, {
      gitRemoteUrl: cloneRepositoryUrl,
      gitAccessToken: gitAccessToken ?? undefined,
    });
    project = await prisma.project.update({
      where: { id: project.id },
      data: { environmentStatus: parseEnvStatus(env.status) },
    });
    return { project };
  } catch (e) {
    await prisma.project.update({
      where: { id: project.id },
      data: { environmentStatus: "ERROR" },
    });
    project = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    return {
      project,
      environmentWarning: formatEnvironmentProvisionFailure(e),
    };
  }
}

async function ensureRunningEnvironment(
  projectId: string,
  userId: string,
): Promise<RemoteEnvironment> {
  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, userId),
    select: { id: true, userId: true, cloneRepositoryUrl: true, slug: true },
  });
  if (!project) throw new Error("Project not found");

  const createOpts = {
    ...(project.cloneRepositoryUrl
      ? {
          gitRemoteUrl: project.cloneRepositoryUrl,
          gitAccessToken: (await getGithubAccessTokenForUser(project.userId)) ?? undefined,
        }
      : {}),
    projectSlug: project.slug,
  };

  const rows = await fetchEnvironmentsForProject(projectId);
  let active = pickActiveRuntimeEnvironment(rows);

  if (!active) {
    const stopped = rows.find((r) => r.status === "STOPPED" && r.containerId);
    if (stopped) {
      active = await remoteStartEnvironment(stopped.id);
    } else if (!rows.length) {
      active = await remoteCreateEnvironment(projectId, "node:20-alpine", createOpts);
    } else {
      await remoteDestroyEnvironment(rows[0]!.id);
      const image =
        typeof rows[0]!.image === "string" && rows[0]!.image.length > 0
          ? rows[0]!.image
          : "node:20-alpine";
      active = await remoteCreateEnvironment(projectId, image, createOpts);
    }
  } else if (active.status === "STOPPED") {
    active = await remoteStartEnvironment(active.id);
  }

  if (!active) throw new Error("Could not start environment");

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const fresh = await fetchEnvironmentsForProject(projectId);
    const env = pickActiveRuntimeEnvironment(fresh);
    if (env?.status === "RUNNING") {
      await prisma.project.update({
        where: { id: projectId },
        data: { environmentStatus: "RUNNING" },
      });
      return env;
    }
    if (env?.status === "ERROR") throw new Error("Environment entered ERROR state");
    await sleep(2_000);
  }
  throw new Error("Timed out waiting for environment to become RUNNING");
}

async function startAppProcess(envId: string): Promise<string> {
  let pkg: PackageJson | null = null;
  try {
    const sel = await remoteWorkspaceSelection(envId, "package.json");
    if (sel.kind === "file" && sel.content) {
      pkg = JSON.parse(sel.content) as PackageJson;
    }
  } catch {
    pkg = null;
  }

  const runCommand = detectRunCommand(pkg);
  const hasPackageJson = pkg !== null;
  const installStep = hasPackageJson
    ? '([ -d node_modules ] || (echo "[synaro] Installing dependencies..." >> /tmp/app.log && npm install --loglevel=warn >> /tmp/app.log 2>&1)) && '
    : "";

  const killPort3000 = [
    'INODE=$(awk "NR>1 && \\$2 ~ /:0BB8/ {print \\$10}" /proc/net/tcp /proc/net/tcp6 2>/dev/null | head -1)',
    'if [ -n "$INODE" ]; then',
    '  for piddir in /proc/[0-9]*/fd; do',
    '    if ls -la "$piddir" 2>/dev/null | grep -q "socket:\\[$INODE\\]"; then',
    '      PID=${piddir%/fd}; PID=${PID#/proc/}',
    '      kill -9 "$PID" 2>/dev/null || true',
    '    fi',
    '  done',
    'fi',
  ].join("\n");

  const patchNextConfig = [
    'for _cfg in next.config.js next.config.mjs next.config.ts next.config.cjs; do',
    '  [ -f "$_cfg" ] && sed -i "/distDir/d" "$_cfg" 2>/dev/null || true',
    'done',
  ].join("\n");

  const bgScript = [
    "rm -f /tmp/app.log",
    killPort3000,
    `(cd /tmp/synaro-workspace/app 2>/dev/null || cd /tmp/synaro-workspace 2>/dev/null; ${patchNextConfig} && ${installStep}echo "[synaro] Starting: ${runCommand}" >> /tmp/app.log && PORT=3000 ${runCommand} >> /tmp/app.log 2>&1) &`,
    "APP_PID=$!",
    "echo $APP_PID > /tmp/app.pid",
    'echo "SYNARO_PID:$APP_PID"',
  ].join("\n");

  await remoteExecTerminal(envId, bgScript);
  return runCommand;
}

export async function deployProjectForUser(
  projectId: string,
  userId: string,
  opts?: { waitUntilReady?: boolean; timeoutSeconds?: number },
): Promise<{
  environment_status: EnvironmentStatus;
  run_status: "starting" | "running" | "not_ready";
  preview_url: string | null;
  command: string;
}> {
  const env = await ensureRunningEnvironment(projectId, userId);
  const previewUrl = env.publicUrl ?? `/api/preview/${env.id}`;
  const command = await startAppProcess(env.id);

  let runStatus: "starting" | "running" | "not_ready" = "starting";
  if (opts?.waitUntilReady !== false) {
    const timeoutMs = Math.min(Math.max((opts?.timeoutSeconds ?? 120) * 1000, 5_000), 300_000);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await remoteExecTerminal(env.id, PORT_CHECK_CMD);
      if (result.output.includes("SYNARO_READY")) {
        runStatus = "running";
        break;
      }
      await sleep(2_000);
    }
    if (runStatus !== "running") runStatus = "not_ready";
  }

  return {
    environment_status: "RUNNING",
    run_status: runStatus,
    preview_url: previewUrl,
    command,
  };
}

export async function getProjectRuntimeLogs(
  projectId: string,
  userId: string,
  lines = 150,
): Promise<string[]> {
  const owned = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, userId),
    select: { id: true },
  });
  if (!owned) throw new Error("Project not found");

  const envs = await fetchEnvironmentsForProject(projectId).catch(() => []);
  const env = pickActiveRuntimeEnvironment(envs);
  if (!env) throw new Error("No running environment. Start the runtime first.");

  const n = Math.min(Math.max(Math.floor(lines), 1), 500);
  const result = await remoteExecTerminal(
    env.id,
    `tail -n ${n} /tmp/app.log 2>/dev/null || echo '(no logs yet)'`,
  );
  return result.output.split("\n");
}
