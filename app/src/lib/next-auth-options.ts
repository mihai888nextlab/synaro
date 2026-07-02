import { type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

/** Avoid registering Google with empty env (breaks OAuth discovery / sign-in). */
function googleProvider() {
  if (!googleClientId || !googleClientSecret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[next-auth] Google OAuth disabled: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET",
      );
    }
    return null;
  }

  return GoogleProvider({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    /**
     * If the user already signed up with email/password, link this Google account to the same User row
     * when emails match (Google verifies email ownership).
     */
    allowDangerousEmailAccountLinking: true,
    /**
     * Prisma `User.name` is required — Google can omit `name`; normalize so adapter insert succeeds.
     */
    profile(profile) {
      const email = profile.email?.toLowerCase().trim() ?? undefined;
      const local = email?.includes("@") ? email.split("@")[0] : undefined;
      return {
        id: profile.sub,
        name: profile.name?.trim() || local || "Synaro user",
        email,
        image: profile.picture ?? null,
      };
    },
  });
}

/** Instantiated once — do not add a second `googleProvider()` call below. */
const googleAuth = googleProvider();

const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

function githubProvider() {
  if (!githubClientId || !githubClientSecret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[next-auth] GitHub OAuth disabled: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET",
      );
    }
    return null;
  }

  return GitHubProvider({
    clientId: githubClientId,
    clientSecret: githubClientSecret,
    /** List user repos for import UI (`read:user` + `user:email` are defaults; `repo` includes private repos). */
    authorization: {
      params: {
        scope: "read:user user:email repo",
      },
    },
    /** Link GitHub to an existing Synaro user when the verified email matches (same as Google). */
    allowDangerousEmailAccountLinking: true,
    profile(profile) {
      const email = profile.email?.toLowerCase().trim() ?? undefined;
      const login = typeof profile.login === "string" ? profile.login : undefined;
      const local = login ?? (email?.includes("@") ? email.split("@")[0] : undefined);
      return {
        id: String(profile.id),
        name: profile.name?.trim() || local || "Synaro user",
        email,
        image: profile.avatar_url ?? null,
      };
    },
  });
}

const githubAuth = githubProvider();

if (process.env.NODE_ENV === "development") {
  if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    console.warn(
      "[next-auth] Set NEXTAUTH_SECRET (or AUTH_SECRET) for reliable sessions and OAuth providers.",
    );
  }
  if (!process.env.NEXTAUTH_URL) {
    console.warn(
      "[next-auth] NEXTAUTH_URL is unset; set it to your site origin (e.g. http://localhost:3000) so OAuth redirect URIs match.",
    );
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleAuth ? [googleAuth] : []),
    ...(githubAuth ? [githubAuth] : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { preferredLocale: true, name: true },
          });
          if (dbUser?.preferredLocale && isLocale(dbUser.preferredLocale)) {
            token.preferredLocale = dbUser.preferredLocale;
          }
          if (dbUser?.name) token.name = dbUser.name;
        } catch (err) {
          console.error("[next-auth] jwt user lookup failed:", err);
        }
      }
      if (trigger === "update") {
        const nextName =
          typeof session?.name === "string"
            ? session.name.trim()
            : typeof session?.user?.name === "string"
              ? session.user.name.trim()
              : "";
        if (nextName) {
          token.name = nextName;
        }
        const nextLocale = session?.preferredLocale;
        if (isLocale(nextLocale)) {
          token.preferredLocale = nextLocale;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = String(token.id);
      }
      if (session.user && isLocale(token.preferredLocale)) {
        session.user.preferredLocale = token.preferredLocale;
      }
      if (session.user && typeof token.name === "string") {
        session.user.name = token.name;
      }
      return session;
    },
  },
};
