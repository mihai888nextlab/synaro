import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      preferredLocale?: string;
    };
    preferredLocale?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    preferredLocale?: string;
  }
}
