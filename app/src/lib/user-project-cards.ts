import type { Project } from "@prisma/client";

import type { DashboardKpiItem } from "@/components/ui/dashboard-kpi-strip";
import { getUserActivityLogs } from "@/lib/activity-log";
import type { SynaroProjectCardModel } from "@/components/ui/project-cards-grid";
import {
  latestEnvironmentSummariesByProjectId,
  parseEnvironmentStatusFromService,
} from "@/lib/environment-service-live";
import { projectRowToCardModel } from "@/lib/map-project-to-card";
import { whereProjectVisibleToUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

/** Projects visible to the user with live environment status merged (same shape as `/api/projects` GET). */
export async function getUserProjectCardsWithRows(userId: string): Promise<{
  rows: Project[];
  cards: SynaroProjectCardModel[];
}> {
  const rows = await prisma.project.findMany({
    where: whereProjectVisibleToUser(userId),
    orderBy: { updatedAt: "desc" },
  });
  const live = await latestEnvironmentSummariesByProjectId(rows.map((r) => r.id));
  const cards = rows.map((row, i) => {
    const s = live[row.id];
    const st = s ? parseEnvironmentStatusFromService(s.status) : null;
    const merged = st ? { ...row, environmentStatus: st } : row;
    return projectRowToCardModel(merged, i, { viewerUserId: userId });
  });
  return { rows, cards };
}

function buildKpiItems(rows: Project[], cards: SynaroProjectCardModel[]): DashboardKpiItem[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - weekMs;
  const updatedThisWeek = rows.filter((r) => r.updatedAt.getTime() >= weekAgo).length;

  const running = cards.filter((c) => c.environmentStatus === "RUNNING");
  const provisioning = cards.filter((c) => c.environmentStatus === "PROVISIONING").length;
  const errors = cards.filter((c) => c.environmentStatus === "ERROR").length;
  const stopped = cards.filter((c) => c.environmentStatus === "STOPPED").length;

  function runningFootTitles(items: SynaroProjectCardModel[]) {
    if (items.length <= 3) return items.map((c) => c.title).join(", ");
    return `${items
      .slice(0, 3)
      .map((c) => c.title)
      .join(", ")} +${items.length - 3} more`;
  }

  const runningFoot =
    running.length === 0
      ? { footKey: "dashboard.kpiNoEnvironmentsRunning" as const, foot: "No environments running" }
      : {
          foot: runningFootTitles(running),
        };

  return [
    {
      metricKey: "projects" as const,
      label: "Projects",
      value: String(cards.length),
      foot:
        updatedThisWeek > 0
          ? `${updatedThisWeek} updated in the last 7 days`
          : "No project updates in the last 7 days",
      footKey:
        updatedThisWeek > 0 ? "dashboard.kpiProjectsUpdatedWeek" : "dashboard.kpiProjectsNoUpdates",
      ...(updatedThisWeek > 0 ? { footParams: { count: updatedThisWeek } } : {}),
      footPositive: updatedThisWeek > 0,
    },
    {
      metricKey: "running" as const,
      label: "Running",
      value: String(running.length),
      foot: runningFoot.foot,
      ...("footKey" in runningFoot ? { footKey: runningFoot.footKey } : {}),
      footPositive: running.length > 0,
    },
    {
      metricKey: "starting" as const,
      label: "Starting",
      value: String(provisioning),
      foot: provisioning > 0 ? "Provisioning in progress" : "Nothing starting right now",
      footKey: provisioning > 0 ? "dashboard.kpiProvisioning" : "dashboard.kpiNothingStarting",
      footPositive: provisioning > 0,
    },
    {
      metricKey: "stopped_errors" as const,
      label: "Stopped / errors",
      value: String(stopped + errors),
      foot:
        errors > 0
          ? `${errors} need attention`
          : stopped > 0
            ? `${stopped} stopped`
            : "All clear",
      footKey:
        errors > 0
          ? "dashboard.kpiNeedAttention"
          : stopped > 0
            ? "dashboard.kpiStoppedCount"
            : "dashboard.kpiAllClear",
      ...(errors > 0
        ? { footParams: { count: errors } }
        : stopped > 0
          ? { footParams: { count: stopped } }
          : {}),
      footPositive: errors === 0,
    },
  ];
}

/** Data for `/dashboard`: project cards, KPI strip, and recent activity logs. */
export async function getDashboardProjectPayload(userId: string) {
  const { rows, cards } = await getUserProjectCardsWithRows(userId);
  const activityLogs = await getUserActivityLogs(userId, { limit: 12, timeFormat: "relative" });
  return {
    projects: cards,
    kpiItems: buildKpiItems(rows, cards),
    activityLogs,
  };
}
