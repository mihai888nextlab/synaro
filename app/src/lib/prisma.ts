import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  return "postgresql://synaro_user:synaro_local_password@localhost:5433/synaro_frontend";
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

