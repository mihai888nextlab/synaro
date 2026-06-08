import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/next-auth-options";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    if (req.method === "GET") {
      const invite = await prisma.projectInvite.findFirst({
        where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
        include: { project: { select: { name: true, slug: true } } },
      });
      if (!invite) {
        res.status(404).json({ error: "Invalid or expired invite" });
        return;
      }
      res.status(200).json({ project: invite.project });
      return;
    }

    if (req.method === "POST") {
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user?.id) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const invite = await prisma.projectInvite.findFirst({
        where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
        include: { project: { select: { id: true, slug: true, userId: true } } },
      });
      if (!invite) {
        res.status(404).json({ error: "Invalid or expired invite" });
        return;
      }

      const uid = session.user.id;
      const p = invite.project;

      if (p.userId === uid) {
        res.status(200).json({ ok: true, slug: p.slug, alreadyOwner: true });
        return;
      }

      const existing = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: p.id, userId: uid } },
      });
      if (existing) {
        res.status(200).json({ ok: true, slug: p.slug, alreadyMember: true });
        return;
      }

      await prisma.projectMember.create({
        data: { projectId: p.id, userId: uid },
      });

      res.status(200).json({ ok: true, slug: p.slug });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).end();
  } catch (err) {
    console.error("[api/invites/[token]]", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
