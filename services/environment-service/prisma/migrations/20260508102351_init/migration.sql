-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('INACTIVE', 'PROVISIONING', 'RUNNING', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "containerId" TEXT,
    "image" TEXT NOT NULL DEFAULT 'node:20-alpine',
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'INACTIVE',
    "port" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");
