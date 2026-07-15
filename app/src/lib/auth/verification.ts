import { prisma } from "@/lib/prisma";

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, passwordHash: true },
  });
  if (!user) return false;
  if (!user.passwordHash) return true;
  return Boolean(user.emailVerified);
}

export async function markEmailVerified(email: string): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) return false;

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });
  return true;
}
