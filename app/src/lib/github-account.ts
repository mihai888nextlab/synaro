import { prisma } from "@/lib/prisma";

/** OAuth access token for the user's linked GitHub account (NextAuth `Account`). */
export async function getGithubAccessTokenForUser(userId: string): Promise<string | null> {
  const acc = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  const t = acc?.access_token?.trim();
  return t || null;
}
