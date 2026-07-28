import type { ActivityLogStatus, EnvironmentStatus } from "@prisma/client";

import type { DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { whereProjectVisibleToUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { formatLogTimestamp, formatShortRelativeTime } from "@/lib/relative-time";
import { getUserAgentCards } from "@/lib/user-agents";

/** Midnight UTC for the given instant — activity logs are kept for the current UTC day only. */
export function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Remove activity log rows from before today (UTC). Safe to call on every read. */
export async function purgeActivityLogsFromPreviousDays(): Promise<number> {
  const cutoff = startOfUtcDay();
  const { count } = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}

function toRowStatus(status: ActivityLogStatus): DashboardLogRow["status"] {
  switch (status) {
    case "RUNNING":
      return "running";
    case "STOPPED":
      return "stopped";
    case "DONE":
    default:
      return "done";
  }
}

function activityStatusFromEnvironment(env: EnvironmentStatus): ActivityLogStatus {
  switch (env) {
    case "RUNNING":
    case "PROVISIONING":
      return "RUNNING";
    case "STOPPED":
    case "ERROR":
    case "INACTIVE":
      return "STOPPED";
    default:
      return "DONE";
  }
}

export function dockerActivityMessage(
  kind: "start" | "stop",
  env: EnvironmentStatus,
): string {
  if (kind === "stop") {
    return env === "INACTIVE" ? "Environment idle" : "Container stopped";
  }
  if (env === "PROVISIONING") return "Container starting";
  if (env === "RUNNING") return "Container started";
  if (env === "ERROR") return "Container start failed";
  return "Container start requested";
}

export type AgentActivityKind =
  | "created"
  | "deleted"
  | "run_started"
  | "run_completed"
  | "run_failed"
  | "run_cancelled";

export function agentActivityMessage(kind: AgentActivityKind, agentName: string): string {
  const name = agentName.trim() || "Agent";
  switch (kind) {
    case "created":
      return `Agent created — ${name}`;
    case "deleted":
      return `Agent deleted — ${name}`;
    case "run_started":
      return `Agent run started — ${name}`;
    case "run_completed":
      return `Agent run completed — ${name}`;
    case "run_failed":
      return `Agent run failed — ${name}`;
    case "run_cancelled":
      return `Agent run cancelled — ${name}`;
    default:
      return `Agent activity — ${name}`;
  }
}

function agentActivityStatus(kind: AgentActivityKind): ActivityLogStatus {
  switch (kind) {
    case "run_started":
      return "RUNNING";
    case "run_failed":
    case "run_cancelled":
      return "STOPPED";
    default:
      return "DONE";
  }
}

/** Resolve a deep-link for an activity log row from stored ids + project slug. */
export function activityLogHref(input: {
  agentId?: string | null;
  runId?: string | null;
  projectSlug?: string | null;
}): string | undefined {
  const agentId = input.agentId?.trim();
  const runId = input.runId?.trim();
  const projectSlug = input.projectSlug?.trim();

  if (agentId && runId) {
    return `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`;
  }
  if (agentId) {
    return `/agents?highlight=${encodeURIComponent(agentId)}`;
  }
  if (projectSlug) {
    return `/projects/${encodeURIComponent(projectSlug)}`;
  }
  return undefined;
}

export async function recordProjectActivityLog(input: {
  userId: string;
  projectId: string;
  action: string;
  status: ActivityLogStatus;
}): Promise<void> {
  await purgeActivityLogsFromPreviousDays();
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      action: input.action,
      status: input.status,
    },
  });
}

export async function recordDockerActivityLog(input: {
  userId: string;
  projectId: string;
  kind: "start" | "stop";
  environmentStatus: EnvironmentStatus;
}): Promise<void> {
  await recordProjectActivityLog({
    userId: input.userId,
    projectId: input.projectId,
    action: dockerActivityMessage(input.kind, input.environmentStatus),
    status: activityStatusFromEnvironment(input.environmentStatus),
  });
}

export async function recordAgentActivityLog(input: {
  userId: string;
  agentName: string;
  kind: AgentActivityKind;
  projectId?: string | null;
  agentId?: string | null;
  runId?: string | null;
}): Promise<void> {
  await purgeActivityLogsFromPreviousDays();
  // Agents live in a separate DB, so their projectId can reference a project that no longer exists in
  // the app DB. ActivityLog.projectId is a real FK, so a dangling id would violate it (→ 500). Drop it.
  let projectId = input.projectId?.trim() || null;
  if (projectId) {
    const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!exists) projectId = null;
  }
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      projectId,
      entityName: input.agentName.trim() || "Agent",
      agentId: input.agentId?.trim() || null,
      runId: input.runId?.trim() || null,
      action: agentActivityMessage(input.kind, input.agentName),
      status: agentActivityStatus(input.kind),
    },
  });
}

export async function getUserActivityLogs(
  userId: string,
  opts?: { limit?: number; timeFormat?: "relative" | "datetime" },
): Promise<DashboardLogRow[]> {
  const limit = opts?.limit ?? 50;
  const timeFormat = opts?.timeFormat ?? "relative";
  const todayStart = startOfUtcDay();

  await purgeActivityLogsFromPreviousDays();

  const projectVisibility = whereProjectVisibleToUser(userId);

  const rows = await prisma.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: todayStart },
      // Agent rows have no project; project rows must be visible to the user.
      OR: [{ project: null }, { project: projectVisibility }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { project: { select: { name: true, slug: true } } },
  });

  const needsAgentLookup = rows.some((row) => !row.agentId && row.entityName);
  const agentIdByName = new Map<string, string>();
  if (needsAgentLookup) {
    const agents = await getUserAgentCards(userId);
    for (const agent of agents) {
      const key = agent.name.trim().toLowerCase();
      if (key && !agentIdByName.has(key)) agentIdByName.set(key, agent.id);
    }
  }

  return rows.map((row) => {
    const resolvedAgentId =
      row.agentId ??
      (row.entityName ? agentIdByName.get(row.entityName.trim().toLowerCase()) : undefined) ??
      null;

    return {
      id: row.id,
      action: row.action,
      project: row.project?.name ?? row.entityName ?? "Agent",
      status: toRowStatus(row.status),
      time:
        timeFormat === "datetime"
          ? formatLogTimestamp(row.createdAt)
          : formatShortRelativeTime(row.createdAt),
      timeTitle: formatLogTimestamp(row.createdAt),
      occurredAt: row.createdAt.toISOString(),
      href:
        activityLogHref({
          agentId: resolvedAgentId,
          runId: row.runId,
          projectSlug: row.project?.slug,
        }) ?? null,
    };
  });
}

/** Minimal activity rows for global search (today's logs only). */
export async function getUserSearchActivityLogs(
  userId: string,
  limit = 30,
): Promise<
  {
    id: string;
    action: string;
    status: string;
    entityName: string;
    occurredAt: string;
    href: string | null;
  }[]
> {
  const todayStart = startOfUtcDay();

  await purgeActivityLogsFromPreviousDays();

  const projectVisibility = whereProjectVisibleToUser(userId);

  const rows = await prisma.activityLog.findMany({
    where: {
      userId,
      createdAt: { gte: todayStart },
      OR: [{ project: null }, { project: projectVisibility }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { project: { select: { name: true, slug: true } } },
  });

  const needsAgentLookup = rows.some((row) => !row.agentId && row.entityName);
  const agentIdByName = new Map<string, string>();
  if (needsAgentLookup) {
    const agents = await getUserAgentCards(userId);
    for (const agent of agents) {
      const key = agent.name.trim().toLowerCase();
      if (key && !agentIdByName.has(key)) agentIdByName.set(key, agent.id);
    }
  }

  return rows.map((row) => {
    const resolvedAgentId =
      row.agentId ??
      (row.entityName ? agentIdByName.get(row.entityName.trim().toLowerCase()) : undefined) ??
      null;

    return {
      id: row.id,
      action: row.action,
      status: row.status,
      entityName: row.project?.name ?? row.entityName ?? "Agent",
      occurredAt: row.createdAt.toISOString(),
      href:
        activityLogHref({
          agentId: resolvedAgentId,
          runId: row.runId,
          projectSlug: row.project?.slug,
        }) ?? null,
    };
  });
}
