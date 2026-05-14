import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { slugifyProjectName } from "@/lib/project-slug";

export async function allocateUniqueProjectSlug(prisma: PrismaClient, name: string): Promise<string> {
  const base = slugifyProjectName(name);
  for (let i = 0; i < 64; i++) {
    const suffix = i === 0 ? "" : `-${randomBytes(2).toString("hex")}`;
    const slug = `${base}${suffix}`.slice(0, 64);
    const clash = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) return slug;
  }
  throw new Error("Could not allocate a unique slug");
}
