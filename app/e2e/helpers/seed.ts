import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@synaro.test";
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-12";
export const E2E_USER_NAME = "E2E Test User";

export const E2E_PROJECT_PRIMARY_SLUG = "e2e-demo-app";
export const E2E_PROJECT_PRIMARY_NAME = "E2E Demo App";
export const E2E_PROJECT_SECONDARY_SLUG = "e2e-api-sandbox";
export const E2E_PROJECT_SECONDARY_NAME = "E2E API Sandbox";
export const E2E_ACTIVITY_ACTION = "E2E test — workspace opened";

export async function seedE2eDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: E2E_USER_EMAIL },
      update: {
        name: E2E_USER_NAME,
        passwordHash,
        emailVerified: new Date(),
      },
      create: {
        email: E2E_USER_EMAIL,
        name: E2E_USER_NAME,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    await prisma.apiKey.deleteMany({ where: { userId: user.id } });

    const projects = [
      {
        slug: E2E_PROJECT_PRIMARY_SLUG,
        name: E2E_PROJECT_PRIMARY_NAME,
        description: "Seeded project for Playwright dashboard and workspace tests.",
      },
      {
        slug: E2E_PROJECT_SECONDARY_SLUG,
        name: E2E_PROJECT_SECONDARY_NAME,
        description: "Second seeded project for projects list coverage.",
      },
    ] as const;

    for (const project of projects) {
      await prisma.project.upsert({
        where: { slug: project.slug },
        update: {
          name: project.name,
          description: project.description,
          userId: user.id,
          environmentStatus: "INACTIVE",
        },
        create: {
          slug: project.slug,
          name: project.name,
          description: project.description,
          userId: user.id,
          environmentStatus: "INACTIVE",
        },
      });
    }

    await prisma.activityLog.deleteMany({ where: { userId: user.id } });
    const primary = await prisma.project.findUnique({
      where: { slug: E2E_PROJECT_PRIMARY_SLUG },
    });
    if (primary) {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          projectId: primary.id,
          action: E2E_ACTIVITY_ACTION,
          status: "DONE",
          createdAt: new Date(),
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function resetE2eUserSettingsState(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: E2E_USER_EMAIL } });
    if (!user) return;
    await prisma.user.update({ where: { id: user.id }, data: { name: E2E_USER_NAME } });
    await prisma.apiKey.deleteMany({ where: { userId: user.id } });
  } finally {
    await prisma.$disconnect();
  }
}
