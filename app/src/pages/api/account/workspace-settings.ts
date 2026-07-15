import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import {
  parseWorkspaceSettingsFromUser,
  validateWorkspaceSettingsPatch,
  type UserWorkspaceSettings,
} from "@/lib/user-workspace-settings";

type WorkspaceSettingsResponse = UserWorkspaceSettings | { error: string };

function isPrismaSchemaMismatch(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = String((err as { message?: string }).message ?? "");
  return (
    message.includes("Unknown field") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("Invalid `prisma")
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkspaceSettingsResponse>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          idleStopMinutes: true,
          defaultAgentModel: true,
          defaultAgentMaxSteps: true,
          defaultAgentToolMode: true,
        },
      });
      if (!user) return res.status(404).json({ error: "User not found." });
      return res.status(200).json(parseWorkspaceSettingsFromUser(user));
    } catch (err) {
      console.error("[workspace-settings] GET failed:", err);
      if (isPrismaSchemaMismatch(err)) {
        return res.status(200).json(parseWorkspaceSettingsFromUser({}));
      }
      return res.status(500).json({ error: "Could not load workspace settings." });
    }
  }

  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const parsed = validateWorkspaceSettingsPatch({
      idleStopMinutes:
        typeof body.idleStopMinutes === "number" ? body.idleStopMinutes : undefined,
      defaultAgentModel:
        typeof body.defaultAgentModel === "string" ? body.defaultAgentModel : undefined,
      defaultAgentMaxSteps:
        typeof body.defaultAgentMaxSteps === "number" ? body.defaultAgentMaxSteps : undefined,
      defaultAgentToolMode:
        body.defaultAgentToolMode === "auto" || body.defaultAgentToolMode === "manual"
          ? body.defaultAgentToolMode
          : undefined,
    });

    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: parsed.data,
        select: {
          idleStopMinutes: true,
          defaultAgentModel: true,
          defaultAgentMaxSteps: true,
          defaultAgentToolMode: true,
        },
      });

      return res.status(200).json(parseWorkspaceSettingsFromUser(user));
    } catch (err) {
      console.error("[workspace-settings] PATCH failed:", err);
      if (isPrismaSchemaMismatch(err)) {
        return res.status(503).json({
          error:
            "Workspace settings are unavailable until the database is migrated and the dev server is restarted. Run: npm run db:migrate:local",
        });
      }
      return res.status(500).json({ error: "Could not save workspace settings." });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
