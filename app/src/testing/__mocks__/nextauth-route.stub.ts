import type { NextAuthOptions } from "next-auth";

/** Minimal stub so Jest never loads the real NextAuth route (avoids `jose` ESM in node_modules). */
export const authOptions: NextAuthOptions = {
  providers: [],
  secret: "jest-auth-secret-32-characters-minimum",
};
