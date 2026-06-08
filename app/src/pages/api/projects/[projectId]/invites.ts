import { randomBytes } from "node:crypto";

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

function publicAppUrl(req: NextApiRequest): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const xf = req.headers["x-forwarded-proto"];
  const proto =
    typeof xf === "string" && xf.trim()
      ? xf.split(",")[0]!.trim()
      : "http";
  const host = req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).end();
      return;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.projectInvite.create({
      data: {
        token,
        projectId,
        createdById: session.user.id,
        expiresAt,
      },
    });

    const base = publicAppUrl(req);
    const inviteUrl = `${base}/projects/invite/${token}`;

    res.status(201).json({
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[api/projects/.../invites]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
