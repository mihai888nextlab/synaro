-- AlterTable
ALTER TABLE "User" ADD COLUMN "dashboardLayout" JSONB,
ADD COLUMN "dashboardLayoutVersion" INTEGER NOT NULL DEFAULT 1;
