import type { ActivityLogStatus, EnvironmentStatus } from "@prisma/client";

import type { DashboardLogRow } from "@/components/ui/dashboard-logs-table";
import { whereProjectVisibleToUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { formatLogTimestamp, formatShortRelativeTime } from "@/lib/relative-time";

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

export async function getUserActivityLogs(
  userId: string,
  opts?: { limit?: number; timeFormat?: "relative" | "datetime" },
): Promise<DashboardLogRow[]> {
  const limit = opts?.limit ?? 50;
  const timeFormat = opts?.timeFormat ?? "relative";
  const todayStart = startOfUtcDay();

  await purgeActivityLogsFromPreviousDays();

  const rows = await prisma.activityLog.findMany({
    where: {
      project: whereProjectVisibleToUser(userId),
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { project: { select: { name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    project: row.project.name,
    status: toRowStatus(row.status),
    time:
      timeFormat === "datetime"
        ? formatLogTimestamp(row.createdAt)
        : formatShortRelativeTime(row.createdAt),
    timeTitle: formatLogTimestamp(row.createdAt),
    occurredAt: row.createdAt.toISOString(),
  }));
}
